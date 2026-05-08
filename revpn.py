import asyncio
import logging
import random
import string
import sqlite3
import time
import uuid
import json
import requests
import urllib3
import urllib.parse
import hashlib
import hmac
import os
from datetime import datetime, timedelta

from aiogram import Bot, Dispatcher, F, types
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command, StateFilter
from aiogram.utils.keyboard import InlineKeyboardBuilder, InlineKeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError, TelegramRetryAfter
from aiohttp import web

# Отключаем предупреждения об SSL-сертификатах
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ================= CONFIG =================
BOT_TOKEN = "8690108311:AAEzqp3ifymMqx93Ro5hPpCw777BXKunhFE"
ADMIN_ID = 1013095495

# Настройки панели
PANEL_URL = "https://2.27.41.29:3151/hQYUJnXCTJmD9TC8Gb"
PANEL_LOGIN = "9lv6a34xEE"
PANEL_PASSWORD = "wQbMjft4Mn"
SERVER_IP = "2.27.41.29"

# ЮMoney
YOOMONEY_WALLET = os.getenv("YOOMONEY_WALLET", "4100119507855052")  # Замени на свой кошелек
YOOMONEY_SECRET_KEY = os.getenv("YOOMONEY_SECRET_KEY", "NoJl5cvX6bhFkB7zV/N+QMqT")  # Замени на свой секрет
YOOMONEY_WEBHOOK_PORT = 8081
WEBHOOK_HOST = "http://2.27.41.29"
YOOMONEY_WEBHOOK_PATH = "/yoomoney/confirm"
YOOMONEY_TEST_SECRET = os.getenv("YOOMONEY_TEST_SECRET", "a7f9c2e4d1b8f3g5h6k8m9p0q1r2s3t4")  # Секрет для тестового эндпоинта - ИЗМЕНИ НА СВОЙ!
YOOMONEY_SECRET = "NoJl5cvX6bhFkB7zV/N+QMqT"
# VLESS Reality
VLESS_INBOUND_ID = 1 
VLESS_PORT = 443
VLESS_FLOW = "xtls-rprx-vision"  # Flow для VLESS при создании пользователя
REALITY_PBK = "YHxcKN2X9gF1zmN1IT03LnsH8X3p4H7UjnZB8CbM7ic" 
REALITY_SNI = "ajax.googleapis.com"
REALITY_SID = "b007da7386eb"

# Цены (рубли)
PRICE_1_MONTH = 99
PRICE_3_MONTHS = 249
PRICE_6_MONTHS = 459

SEPARATOR = "━━━━━━━━━━━━━━━━━━"

# ================= DB INIT =================
def db(query, args=(), fetch=False, all=False):
    with sqlite3.connect("bot_database.db") as conn:
        cur = conn.cursor()
        cur.execute(query, args)
        if fetch:
            return cur.fetchone()
        if all:
            return cur.fetchall()
        conn.commit()
        return cur.lastrowid

def generate_subscription_token(length: int = 16) -> str:
    """Генерирует уникальный токен для ссылки подписки"""
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(length))

def migrate_db():
    """Миграция БД - добавляет новые колонки если их нет"""
    try:
        # Проверяем наличие колонки username
        result = db("PRAGMA table_info(users)", all=True)
        columns = [col[1] for col in result] if result else []
        
        if "username" not in columns:
            db("ALTER TABLE users ADD COLUMN username TEXT")
            logging.info("Added username column to users table")
        
        # Проверяем наличие колонки subscription_token в devices
        result = db("PRAGMA table_info(devices)", all=True)
        device_columns = [col[1] for col in result] if result else []
        
        if "subscription_token" not in device_columns:
            # Добавляем колонку без UNIQUE ограничения (так как могут быть NULL значения)
            db("ALTER TABLE devices ADD COLUMN subscription_token TEXT")
            logging.info("Added subscription_token column to devices table")
            
            # Попытка подтянуть токены с панели. Если не удалось, используем device_uuid.
            if not sync_subscription_tokens_from_panel():
                all_devices = db("SELECT device_uuid FROM devices WHERE subscription_token IS NULL", all=True)
                if all_devices:
                    for (device_uuid,) in all_devices:
                        db("UPDATE devices SET subscription_token=? WHERE device_uuid=?", (device_uuid, device_uuid))
                    logging.info(f"Generated subscription tokens for {len(all_devices)} devices")
        else:
            # Если колонка уже есть, пытаемся синхронизировать существующие записи по panel client IDs
            sync_subscription_tokens_from_panel()
        
        # Удаляем старые колонки SOCKS5 из таблицы devices, если они остались
        result = db("PRAGMA table_info(devices)", all=True)
        device_columns = [col[1] for col in result] if result else []
        if "socks_user" in device_columns or "socks_pass" in device_columns:
            db("""CREATE TABLE IF NOT EXISTS devices_new (
                device_id INTEGER PRIMARY KEY AUTOINCREMENT,
                tg_id INTEGER NOT NULL,
                device_uuid TEXT UNIQUE NOT NULL,
                device_name TEXT,
                created_at REAL,
                expiry REAL,
                subscription_token TEXT,
                FOREIGN KEY(tg_id) REFERENCES users(tg_id)
            )""")
            cols_to_copy = [c for c in ["tg_id", "device_uuid", "device_name", "created_at", "expiry", "subscription_token"] if c in device_columns]
            columns_list = ", ".join(cols_to_copy)
            db(f"INSERT INTO devices_new ({columns_list}) SELECT {columns_list} FROM devices")
            db("DROP TABLE devices")
            db("ALTER TABLE devices_new RENAME TO devices")
            logging.info("Removed SOCKS5 columns from devices table")

    except Exception as e:
        logging.error(f"Migration error: {e}")

def init_db():
    db("""CREATE TABLE IF NOT EXISTS users (
        tg_id INTEGER PRIMARY KEY,
        username TEXT,
        expiry REAL,
        is_active INTEGER DEFAULT 0
    )""")
    db("""CREATE TABLE IF NOT EXISTS devices (
        device_id INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_id INTEGER NOT NULL,
        device_uuid TEXT UNIQUE NOT NULL,
        device_name TEXT,
        created_at REAL,
        expiry REAL,
        FOREIGN KEY(tg_id) REFERENCES users(tg_id)
    )""")

    db("""CREATE TABLE IF NOT EXISTS promos (
        code TEXT PRIMARY KEY,
        days INTEGER,
        usage_limit INTEGER,
        current_usage INTEGER DEFAULT 0
    )""")
    db("""CREATE TABLE IF NOT EXISTS device_promos (
        code TEXT PRIMARY KEY,
        usage_limit INTEGER,
        current_usage INTEGER DEFAULT 0
    )""")
    # Запускаем миграцию
    migrate_db()

# ================= 3X-UI API =================
session = requests.Session()

def login_panel():
    try:
        url = f"{PANEL_URL}/login"
        payload = {"username": PANEL_LOGIN, "password": PANEL_PASSWORD}
        resp = session.post(url, data=payload, verify=False, timeout=10)
        return resp.status_code == 200 and resp.json().get("success")
    except Exception as e:
        logging.error(f"Panel login error: {e}")
        return False

def add_client(inbound_id, client_email, uuid_str, expiry_time_ms=0, sub_id="", client_comment=""):
    if not login_panel(): return False
    try:
        # Получаем текущий инбаунд
        url = f"{PANEL_URL}/panel/api/inbounds/get/{inbound_id}"
        resp = session.get(url, verify=False, timeout=10)
        if resp.status_code != 200:
            logging.error(f"Failed to get inbound {inbound_id}")
            return False
        
        data = resp.json().get("obj", {})
        settings = json.loads(data.get("settings", "{}"))
        clients = settings.get("clients", [])
        
        # Создаем новый клиент
        client_data = {
            "id": uuid_str,
            "alterId": 0,
            "email": client_email,
            "limitIp": 1,
            "totalGB": 0,
            "expiryTime": int(expiry_time_ms),
            "enable": True,
            "tgId": "",
            "subId": sub_id,
            "flow": VLESS_FLOW,
            "remark": client_comment,
            "comment": client_comment
        }
        clients.append(client_data)
        
        # Отправляем обновленный список
        url = f"{PANEL_URL}/panel/api/inbounds/update/{inbound_id}"
        settings["clients"] = clients
        data["settings"] = json.dumps(settings)
        
        resp = session.post(url, json=data, verify=False, timeout=10)
        success = resp.status_code == 200 and resp.json().get("success", True)
        if not success:
            logging.error(f"Add client failed: {resp.text}")
        return success
    except Exception as e:
        logging.error(f"Add VLESS client error: {e}")
        return False

def update_client_expiry(inbound_id, uuid_str, expiry_time_ms):
    if not login_panel(): return False
    try:
        # Получаем текущий инбаунд
        url = f"{PANEL_URL}/panel/api/inbounds/get/{inbound_id}"
        resp = session.get(url, verify=False, timeout=10)
        if resp.status_code != 200:
            return False
        
        data = resp.json().get("obj", {})
        settings = json.loads(data.get("settings", "{}"))
        clients = settings.get("clients", [])
        
        # Обновляем клиента
        for client in clients:
            if client.get("id") == uuid_str:
                client["expiryTime"] = int(expiry_time_ms)
                client["enable"] = True
                break
        
        # Отправляем обновленный список
        url = f"{PANEL_URL}/panel/api/inbounds/update/{inbound_id}"
        settings["clients"] = clients
        data["settings"] = json.dumps(settings)
        
        resp = session.post(url, json=data, verify=False, timeout=10)
        return resp.status_code == 200 and resp.json().get("success", True)
    except Exception as e:
        logging.error(f"Update expiry error: {e}")
        return False

def update_client_status(inbound_id, uuid_str, enable):
    if not login_panel(): return False
    try:
        # Получаем текущий инбаунд
        url = f"{PANEL_URL}/panel/api/inbounds/get/{inbound_id}"
        resp = session.get(url, verify=False, timeout=10)
        if resp.status_code != 200:
            return False
        
        data = resp.json().get("obj", {})
        settings = json.loads(data.get("settings", "{}"))
        clients = settings.get("clients", [])
        
        # Обновляем статус клиента
        for client in clients:
            if client.get("id") == uuid_str:
                client["enable"] = enable
                break
        
        # Отправляем обновленный список
        url = f"{PANEL_URL}/panel/api/inbounds/update/{inbound_id}"
        settings["clients"] = clients
        data["settings"] = json.dumps(settings)
        
        resp = session.post(url, json=data, verify=False, timeout=10)
        return resp.status_code == 200 and resp.json().get("success", True)
    except Exception as e:
        logging.error(f"Update status error: {e}")
        return False

def get_inbound_clients(inbound_id):
    """Получает список всех клиентов инбаунда с панели"""
    if not login_panel(): return []
    try:
        url = f"{PANEL_URL}/panel/api/inbounds/get/{inbound_id}"
        resp = session.get(url, verify=False, timeout=10)
        if resp.status_code == 200:
            data = resp.json().get("obj", {})
            settings = json.loads(data.get("settings", "{}"))
            return settings.get("clients", [])
        return []
    except Exception as e:
        logging.error(f"Get inbound clients error: {e}")
        return []


def sync_subscription_tokens_from_panel():
    """Синхронизирует subscription_token из панели по subId"""
    try:
        clients = get_inbound_clients(VLESS_INBOUND_ID)
        if not clients:
            return False

        uuid_to_subid = {
            c.get("id"): c.get("subId")
            for c in clients
            if c.get("id") and c.get("subId")
        }
        if not uuid_to_subid:
            return False

        devices = db("SELECT device_id, device_uuid, subscription_token FROM devices", all=True)
        updated = 0
        for device_id, device_uuid, subscription_token in devices:
            if device_uuid and device_uuid in uuid_to_subid:
                desired = uuid_to_subid[device_uuid]
                if desired and subscription_token != desired:
                    db("UPDATE devices SET subscription_token=? WHERE device_id=?", (desired, device_id))
                    updated += 1

        logging.info(f"Synced {updated} device subscription tokens from panel")
        return True
    except Exception as e:
        logging.error(f"Sync subscription tokens error: {e}")
        return False

def delete_client(inbound_id, uuid_str):
    if not login_panel(): return False
    try:
        # Получаем текущий инбаунд
        url = f"{PANEL_URL}/panel/api/inbounds/get/{inbound_id}"
        resp = session.get(url, verify=False, timeout=10)
        if resp.status_code != 200:
            return False
        
        data = resp.json().get("obj", {})
        settings = json.loads(data.get("settings", "{}"))
        clients = settings.get("clients", [])
        
        # Удаляем клиента по UUID
        clients = [c for c in clients if c.get("id") != uuid_str]
        
        # Отправляем обновленный список
        url = f"{PANEL_URL}/panel/api/inbounds/update/{inbound_id}"
        settings["clients"] = clients
        data["settings"] = json.dumps(settings)
        
        resp = session.post(url, json=data, verify=False, timeout=10)
        return resp.status_code == 200 and resp.json().get("success", True)
    except Exception as e:
        logging.error(f"Delete client error: {e}")
        return False

# ================= DEVICE MANAGEMENT =================
def get_user_username(tg_id):
    """Получает username пользователя из БД (с @ если есть)"""
    try:
        user = db("SELECT username FROM users WHERE tg_id=?", (tg_id,), fetch=True)
        if user and user[0]:
            username = user[0]
            # Убираем @ если есть (для правильного форматирования)
            if username.startswith("@"):
                return username[1:]
            return username
        return f"tg_user_{tg_id}"
    except:
        return f"tg_user_{tg_id}"

def create_device(tg_id, device_name, expiry_ms):
    """Создает новое устройство, возвращает UUID"""
    try:
        new_uuid = str(uuid.uuid4())
        subscription_token = generate_subscription_token()
        current_time = time.time()

        device_id = db(
            "INSERT INTO devices (tg_id, device_uuid, device_name, created_at, expiry, subscription_token) VALUES (?, ?, ?, ?, ?, ?)",
            (tg_id, new_uuid, device_name, current_time, expiry_ms // 1000, subscription_token)
        )

        if not device_id:
            return None

        client_email = f"Германия | {subscription_token}"
        client_comment = f"{tg_id}_@{get_user_username(tg_id)}_{device_name}"

        if add_client(VLESS_INBOUND_ID, client_email, new_uuid, expiry_ms, subscription_token, client_comment):
            return new_uuid

        db("DELETE FROM devices WHERE device_id=?", (device_id,))
        return None
    except Exception as e:
        logging.error(f"Create device error: {e}")
        return None

def delete_device(tg_id, device_uuid):
    """Удаляет устройство с панели и БД"""
    try:
        if delete_client(VLESS_INBOUND_ID, device_uuid):
            db("DELETE FROM devices WHERE tg_id=? AND device_uuid=?", (tg_id, device_uuid))
            return True
        return False
    except Exception as e:
        logging.error(f"Delete device error: {e}")
        return False

def sync_devices(tg_id):
    """Синхронизирует устройства пользователя с панелью"""
    try:
        # Получаем клиентов с панели
        panel_clients = get_inbound_clients(VLESS_INBOUND_ID)
        panel_uuids = {c.get("id") for c in panel_clients if c.get("id")}
        
        # Получаем локальные устройства
        local_devices = db("SELECT device_uuid FROM devices WHERE tg_id=?", (tg_id,), all=True)
        local_uuids = {d[0] for d in local_devices}
        
        # Удаляем из БД устройства, которых нет на панели
        uuids_to_remove = local_uuids - panel_uuids
        for uuid_str in uuids_to_remove:
            db("DELETE FROM devices WHERE tg_id=? AND device_uuid=?", (tg_id, uuid_str))
            logging.info(f"Synced: removed device {uuid_str} for user {tg_id}")
        
        return True
    except Exception as e:
        logging.error(f"Sync devices error: {e}")
        return False

def update_all_devices_expiry(tg_id, new_expiry_ms):
    """Обновляет срок для всех устройств пользователя"""
    try:
        devices = db("SELECT device_uuid FROM devices WHERE tg_id=?", (tg_id,), all=True)
        for (uuid_str,) in devices:
            try:
                update_client_expiry(VLESS_INBOUND_ID, uuid_str, new_expiry_ms)
            except Exception as e:
                logging.error(f"Failed to update device {uuid_str}: {e}")
        db("UPDATE devices SET expiry=? WHERE tg_id=?", (new_expiry_ms // 1000, tg_id))
        return True
    except Exception as e:
        logging.error(f"Update all devices expiry error: {e}")
        return False



def get_user_devices(tg_id):
    """Получает все устройства пользователя"""
    devices = db("SELECT device_uuid, device_name, created_at, expiry, subscription_token FROM devices WHERE tg_id=? ORDER BY created_at DESC", 
                 (tg_id,), all=True)
    
    result = []
    for device_uuid, device_name, created_at, expiry, subscription_token in devices:
        result.append({
            'uuid': device_uuid,
            'name': device_name,
            'created_at': created_at,
            'expiry': expiry,
            'subscription_token': subscription_token,
        })
    
    return result

# ================= UTILS =================
def generate_random_string(length):
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(length))

def generate_vless_link(uid):
    # Название профиля - будет показано как имя конфигурации в приложении
    name = urllib.parse.quote("Relight VPN")
    return f"vless://{uid}@{SERVER_IP}:{VLESS_PORT}?type=tcp&security=reality&pbk={REALITY_PBK}&fp=chrome&sni={REALITY_SNI}&sid={REALITY_SID}&spx=%2F&flow={VLESS_FLOW}#{name}"

def generate_subscription_url(token):
    """Генерирует URL подписки для импорта"""
    return f"https://{SERVER_IP}:2096/sub/{token}"

def generate_m3u_content(device_uuid, device_name):
    """Генерирует M3U контент с профилем VLESS"""
    vless_link = generate_vless_link(device_uuid)
    
    profile_name = "🔄 Relight VPN"
    instruction = "🔃 Если VPN не работает, нажмите на 🔃 для обновления"
    device_info = f"Устройство: {device_name}"
    
    # M3U с дополнительными тегами для красивого отображения
    m3u_content = f"""#EXTM3U
#EXT-X-COMMENT: {instruction}
#EXT-X-COMMENT: {device_info}
#EXTINF:-1 tvg-name=\"{profile_name}\" group-title=\"Relight VPN\",{profile_name}
{vless_link}
"""
    return m3u_content.strip()

def generate_yoomoney_link(tg_id, months):
    """
    Генерирует ссылку для оплаты через ЮMoney confirm.xml форму
    Гарантирует переход на форму оплаты с выбором способа (карта, кошелек и т.д.)
    """
    prices = {1: PRICE_1_MONTH, 3: PRICE_3_MONTHS, 6: PRICE_6_MONTHS}
    amount = prices.get(months, PRICE_1_MONTH)
    
    # Очищаем кошелек от пробелов
    wallet = YOOMONEY_WALLET.strip()
    
    # Собираем ссылку по формату confirm.xml
    return f"https://yoomoney.ru/quickpay/confirm.xml?receiver={wallet}&quickpay-form=button&paymentType=AC&sum={int(amount)}&label={tg_id}&targets=VPN"

async def delete_after(message: Message, sleep_time: int = 30):
    await asyncio.sleep(sleep_time)
    try:
        await message.delete()
    except:
        pass

# ================= BOT SETUP =================
logging.basicConfig(level=logging.INFO)
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# ================= KEYBOARDS =================
def main_kb(is_admin=False):
    kb = InlineKeyboardBuilder()
    kb.button(text="👤 Мой профиль", callback_data="profile")
    kb.button(text="🛒 Купить / Продлить", callback_data="buy_sub")
    kb.button(text="🎁 Промокод (VPN)", callback_data="enter_promo")
    kb.button(text="📱 Промокод (Устройство)", callback_data="enter_device_promo")
    kb.button(text="📖 Инструкция", callback_data="how_to_connect")
    kb.button(text="🆘 Поддержка", url="https://t.me/hexyplayer")
    if is_admin:
        kb.button(text="🛠 Админ-панель", callback_data="admin_panel")
    kb.adjust(1, 2, 2, 1, 1)
    return kb.as_markup()

def admin_kb():
    kb = InlineKeyboardBuilder()
    kb.button(text="👥 Список юзеров (20)", callback_data="users_list")
    kb.button(text="📋 Список промо", callback_data="promo_list")
    kb.button(text="➕ Создать промо (VPN)", callback_data="create_promo")
    kb.button(text="📱 Создать промо (Устр)", callback_data="create_device_promo")
    kb.button(text="🗑 Удалить промо", callback_data="delete_promo")
    kb.button(text="✅ Выдать подписку", callback_data="admin_add_sub")
    kb.button(text="❌ Удалить подписку", callback_data="admin_remove_sub")
    kb.button(text="📢 Оповещение всем", callback_data="admin_broadcast")
    kb.button(text="🔙 Назад", callback_data="back_to_main")
    kb.adjust(1, 1, 2, 2, 2, 1)
    return kb.as_markup()

def buy_kb():
    kb = InlineKeyboardBuilder()
    kb.button(text=f"💳 1 Месяц ({PRICE_1_MONTH}₽)", url=generate_yoomoney_link(0, 1))
    kb.button(text=f"💳 3 Месяца ({PRICE_3_MONTHS}₽)", url=generate_yoomoney_link(0, 3))
    kb.button(text=f"💳 6 Месяцев ({PRICE_6_MONTHS}₽)", url=generate_yoomoney_link(0, 6))
    kb.button(text="🔙 Назад", callback_data="back_to_main")
    kb.adjust(1, 1, 1, 1)
    return kb.as_markup()

def buy_kb_with_user(tg_id):
    """
    Генерирует клавиатуру с персональными ссылками ЮMoney
    """
    kb = InlineKeyboardBuilder()
    kb.button(text=f"💳 1 Месяц ({PRICE_1_MONTH}₽)", url=generate_yoomoney_link(tg_id, 1))
    kb.button(text=f"💳 3 Месяца ({PRICE_3_MONTHS}₽)", url=generate_yoomoney_link(tg_id, 3))
    kb.button(text=f"💳 6 Месяцев ({PRICE_6_MONTHS}₽)", url=generate_yoomoney_link(tg_id, 6))
    kb.button(text="🔙 Назад", callback_data="back_to_main")
    kb.adjust(1, 1, 1, 1)
    return kb.as_markup()

# ================= HANDLERS =================
@dp.message(Command("start"))
async def start_cmd(message: Message, state: FSMContext):
    await state.clear()
    tg_id = message.from_user.id
    
    # Получаем username (с @ если есть)
    if message.from_user.username:
        username = f"@{message.from_user.username}"
    else:
        username = f"tg_user_{tg_id}"
    
    # Проверяем и сохраняем пользователя
    user = db("SELECT * FROM users WHERE tg_id=?", (tg_id,), fetch=True)
    if not user:
        db("INSERT INTO users (tg_id, username, expiry, is_active) VALUES (?, ?, ?, ?)", 
           (tg_id, username, time.time(), 0))
        logging.info(f"New user registered: {tg_id} ({username})")
    else:
        db("UPDATE users SET username=? WHERE tg_id=?", (username, tg_id))
        logging.info(f"User updated: {tg_id} ({username})")
    
    text = (f"👋 <b>Привет, {message.from_user.first_name}!</b>\n\n"
            f"🛡️ <b>Relight VPN</b>\n"
            f"Премиальный доступ к свободному интернету 🔓\n\n"
            f"✨ <b>Возможности:</b>\n"
            f"• Без ограничений по скорости\n"
            f"• Без рекламы и трекинга\n"
            f"• Высокая стабильность\n\n"
            f"Выбирай действие в меню 👇")
    
    try:
        await message.answer(text, reply_markup=main_kb(tg_id == ADMIN_ID), parse_mode="HTML")
    except Exception as e:
        logging.error(f"Start command error: {e}")
    
    # Удаляем сообщение /start в конце (после ответа)
    try: 
        await message.delete()
    except TelegramBadRequest:
        pass
    except Exception as e:
        logging.warning(f"Delete start message error: {e}")

@dp.callback_query(F.data == "how_to_connect")
async def manual_call(call: CallbackQuery):
    text = (
        "📖 <b>Инструкция по подключению:</b>\n\n"
        "<b>📱 Шаг 1: Установите приложение</b>\n"
        "  <b>Android:</b> v2rayNG\n"
        "  <b>iOS:</b> Streisand или V2Box\n"
        "  <b>PC Windows:</b> v2rayN\n"
        "  <b>macOS:</b> v2rayU\n\n"
        "<b>� Шаг 2: Копируйте ссылку подписки</b>\n"
        "  Откройте меню → 👤 Мой профиль\n"
        "  Нажмите кнопку 'Копировать первую подписку'\n\n"
        "<b>➕ Шаг 3: Импортируйте подписку</b>\n"
        "  • Откройте приложение v2ray\n"
        "  • Нажмите на меню/+ (добавить)\n"
        "  • Выберите 'Import from URL' или 'Subscription'\n"
        "  • Вставьте скопированную ссылку\n\n"
        "<b>✨ Шаг 4: Готово!</b>\n"
        "  📝 <i>Профиль будет называться 'Relight VPN'</i>\n"
        "  🔃 <i>Если VPN не работает, нажмите на 🔃</i>\n"
        "  🔄 <i>Подписка автоматически обновляется</i>\n\n"
        "🆘 Если возникли сложности — используйте меню поддержки"
    )
    await call.message.edit_text(text, reply_markup=InlineKeyboardBuilder().button(text="🔙 Назад", callback_data="back_to_main").as_markup(), parse_mode="HTML")

@dp.callback_query(F.data == "back_to_main")
async def back_main_call(call: CallbackQuery, state: FSMContext):
    await state.clear()
    try:
        await call.message.edit_text("Главное меню 👇", reply_markup=main_kb(call.from_user.id == ADMIN_ID))
    except TelegramBadRequest:
        await call.answer()

@dp.callback_query(F.data == "profile")
async def profile_call(call: CallbackQuery):
    try:
        tg_id = call.from_user.id
        user = db("SELECT expiry, is_active FROM users WHERE tg_id=?", (tg_id,), fetch=True)
        if not user:
            await call.answer("❌ Нужно нажать /start", show_alert=True)
            return
        
        # Синхронизируем устройства с панелью
        sync_devices(tg_id)
        
        exp, active = user
        devices = get_user_devices(tg_id)
        
        is_valid = active == 1 and exp > time.time()
        status = "✅ Активна" if is_valid else "❌ Неактивна"
        exp_date = datetime.fromtimestamp(exp).strftime('%d.%m.%Y %H:%M') if exp > time.time() else "Истекла"
        
        text = (f"👤 <b>Ваш профиль</b>\n"
                f"{SEPARATOR}\n"
                f"🆔 <b>ID:</b> <code>{tg_id}</code>\n"
                f"📊 <b>Статус подписки:</b> {status}\n"
                f"⏳ <b>Действительна до:</b> <code>{exp_date}</code>\n"
                f"📱 <b>Всего устройств:</b> <code>{len(devices)}</code>\n"
                f"{SEPARATOR}\n")
        
        if devices:
            text += "<b>📱 Ваши ссылки подписки:</b>\n"
            for i, dev in enumerate(devices, 1):
                dev_status = "✅" if dev['expiry'] > time.time() else "⏳"
                subscription_url = generate_subscription_url(dev['subscription_token'])
                
                text += (f"\n{dev_status} <b>Устройство #{i}</b> ({dev['name']})\n"
                        f"  <code>{subscription_url}</code>")
        else:
            text += "⚠️ <i>У вас еще нет активных устройств</i>"
        
        # Клавиатура с кнопками управления
        kb = InlineKeyboardBuilder()
        if devices and is_valid:
            kb.button(text="🔄 Сменить ключ", callback_data="select_device_replace")
            kb.button(text="🗑 Удалить ключ", callback_data="select_device_delete")
        if is_valid and len(devices) < 5:
            kb.button(text="➕ Добавить устройство", callback_data="add_device")
        if devices:
            kb.button(text="📋 Копировать подписку", callback_data="select_device_copy")
        kb.button(text="🔙 Назад", callback_data="back_to_main")
        kb.adjust(1, 1, 1, 1)
        
        try: 
            await call.message.edit_text(text, reply_markup=kb.as_markup(), parse_mode="HTML")
        except TelegramBadRequest:
            await call.answer()
    except Exception as e:
        logging.error(f"Profile call error: {e}")
        await call.answer("❌ Ошибка загрузки профиля", show_alert=True)

@dp.callback_query(F.data == "buy_sub")
async def buy_sub_call(call: CallbackQuery):
    try:
        tg_id = call.from_user.id
        text = ("💳 <b>Выберите тариф:</b>\n\n"
                f"₽ Доступны следующие варианты для оплаты через ЮMoney:")
        
        await call.message.edit_text(text, reply_markup=buy_kb_with_user(tg_id), parse_mode="HTML")
    except TelegramBadRequest:
        await call.answer()
    except Exception as e:
        logging.error(f"Buy sub call error: {e}")
        await call.answer("❌ Ошибка", show_alert=True)

# ================= YOOMONEY PAYMENT =================
async def process_yoomoney_payment(tg_id, months, operation_id):
    """
    Обрабатывает платеж от ЮMoney и выдает подписку
    """
    try:
        days = months * 30
        user = db("SELECT expiry, is_active FROM users WHERE tg_id=?", (tg_id,), fetch=True)
        
        if not user:
            logging.warning(f"User {tg_id} not found for payment processing")
            return False
        
        current_time = time.time()
        # Если у пользователя нет подписки или она истекла - новая подписка
        # Если подписка активна - продляем на указанный срок
        new_exp = max(user[0], current_time) + (days * 24 * 3600)
        
        # Обновляем подписку пользователя
        db("UPDATE users SET expiry=?, is_active=1 WHERE tg_id=?", (new_exp, tg_id))
        
        # Проверяем, есть ли уже устройства
        devices = get_user_devices(tg_id)
        if not devices:
            # Если нет - создаем первое
            device_name = "Устройство 1"
            if create_device(tg_id, device_name, new_exp * 1000):
                msg_text = (f"✅ <b>Оплата подтверждена!</b>\n"
                           f"{SEPARATOR}\n"
                           f"📅 Подписка активирована на <b>{months}</b> месяц(ев)\n"
                           f"⏳ До: <code>{datetime.fromtimestamp(new_exp).strftime('%d.%m.%Y %H:%M')}</code>\n\n"
                           f"🔑 Первый ключ создан!\n"
                           f"📱 Откройте профиль для просмотра всех ключей.")
            else:
                msg_text = ("⚠️ <b>Ошибка создания ключа:</b>\n"
                           "Платеж произведен, но возникла ошибка на сервере.\n"
                           "🆘 Обратитесь в поддержку с вашим ID.")
        else:
            # Обновляем срок для всех существующих устройств
            success = update_all_devices_expiry(tg_id, new_exp * 1000)
            
            if success:
                msg_text = (f"✅ <b>Оплата подтверждена!</b>\n"
                           f"{SEPARATOR}\n"
                           f"📅 Подписка продлена на <b>{months}</b> месяц(ев)\n"
                           f"⏳ До: <code>{datetime.fromtimestamp(new_exp).strftime('%d.%m.%Y %H:%M')}</code>\n\n"
                           f"📱 Все ваши {len(devices)} устройство(а) обновлены!")
            else:
                msg_text = ("⚠️ <b>Ошибка при обновлении:</b>\n"
                           "Платеж произведен, но возникла ошибка на сервере.\n"
                           "🆘 Обратитесь в поддержку с вашим ID.")
        
        # Отправляем сообщение пользователю
        try:
            await bot.send_message(tg_id, msg_text, parse_mode="HTML")
        except Exception as e:
            logging.error(f"Failed to send payment notification to {tg_id}: {e}")
        
        # Отправляем уведомление админу о платеже
        admin_msg_text = (f"💰 <b>Новая оплата получена!</b>\n"
                         f"{SEPARATOR}\n"
                         f"👤 <b>Пользователь:</b> <code>{tg_id}</code>\n"
                         f"💳 <b>Сумма:</b> {months}x месяц(ев)\n"
                         f"📊 <b>Операция:</b> <code>{operation_id}</code>\n"
                         f"⏳ <b>Подписка до:</b> <code>{datetime.fromtimestamp(new_exp).strftime('%d.%m.%Y %H:%M')}</code>\n"
                         f"📱 <b>Устройств:</b> {len(devices)}")
        
        try:
            await bot.send_message(ADMIN_ID, admin_msg_text, parse_mode="HTML")
            logging.info(f"Admin notification sent for payment {operation_id} from user {tg_id}")
        except Exception as e:
            logging.error(f"Failed to send admin notification: {e}")
        
        logging.info(f"Payment processed successfully: user={tg_id}, months={months}, operation={operation_id}, new_expiry={new_exp}")
        return True
    except Exception as e:
        logging.error(f"Payment processing error: {e}")
        return False

async def yoomoney_webhook_handler(request: web.Request) -> web.Response:
    """
    Умный обработчик: сам считает месяцы исходя из суммы
    """
    try:
        data = await request.post()
        data = dict(data)
        
        logging.info(f"[YOOMONEY] Входящий вебхук: {data}")
        
        # 1. Проверка на тестовый пустой вебхук
        label = data.get("label", "")
        if not label:
            logging.info("[YOOMONEY] Тестовое уведомление принято.")
            return web.Response(status=200, text="OK")

        # 2. Получаем основные параметры
        notification_type = data.get("notification_type", "")
        operation_id = data.get("operation_id", "")
        amount = data.get("amount", "0")
        currency = data.get("currency", "643")
        sha1_hash = data.get("sha1_hash", "")
        sender = data.get("sender", "")
        codepro = data.get("codepro", "false")
        datetime_val = data.get("datetime", "")

        # 3. Проверка хэша (Безопасность)
        hash_string = (
            f"{notification_type}&{operation_id}&{amount}&{currency}&"
            f"{datetime_val}&{sender}&{codepro}&{YOOMONEY_SECRET}&{label}"
        )
        calculated_hash = hashlib.sha1(hash_string.encode('utf-8')).hexdigest()
        
        if sha1_hash != calculated_hash:
            logging.error(f"[YOOMONEY] Критическая ошибка: Хэш не совпал!")
            # В режиме отладки можно закомментировать return ниже, если уверен в секрете
            # return web.Response(status=200)

        # 4. Превращаем label в ID пользователя
        try:
            tg_id = int(label)
        except ValueError:
            return web.Response(status=200, text="Invalid label")

        # 5. ДИНАМИЧЕСКИЙ РАСЧЕТ МЕСЯЦЕВ
        try:
            received_amount = float(amount)
            # Берем твою переменную цены за 1 месяц (убедись, что она определена выше в коде)
            # Если сумма меньше цены месяца (например, тест 2 рубля), даем минимум 1 месяц
            if received_amount < PRICE_1_MONTH:
                months = 1
            else:
                # Округляем в ближайшую сторону (например, 297 / 99 = 3)
                months = int(round(received_amount / PRICE_1_MONTH))
            
            # Ограничитель (на всякий случай, например, не больше 12 месяцев)
            if months > 12: months = 12
                
        except Exception as e:
            logging.error(f"Ошибка расчета месяцев: {e}")
            months = 1 # Если что-то пошло не так, даем 1 месяц по умолчанию

        logging.info(f"[YOOMONEY] Платёж принят: Юзер {tg_id} оплатил {received_amount} руб. Начисляем {months} мес.")

        # 6. Зачисляем в базу данных
        success = await process_yoomoney_payment(tg_id, months, operation_id)
        
        if success:
            # Тут можно отправить сообщение пользователю через bot.send_message
            # Но обычно это делает функция process_yoomoney_payment
            return web.Response(status=200, text="OK")
        else:
            return web.Response(status=200, text="DB Error")

    except Exception as e:
        logging.error(f"[YOOMONEY] Ошибка: {e}", exc_info=True)
        return web.Response(status=200, text="Error")
    
async def subscription_handler(request: web.Request) -> web.Response:
    """
    Обработчик subscription ссылок
    Возвращает M3U контент с VLESS для импорта в приложение
    """
    try:
        # Получаем токен из URL
        token = request.match_info.get('token', '')
        
        if not token:
            return web.Response(status=404, text="Not found")
        
        logging.info(f"[SUB] Запрос подписки с токеном: {token}")
        
        # Получаем устройство по токену
        device = db("SELECT device_uuid, device_name FROM devices WHERE subscription_token=?", (token,), fetch=True)
        
        if not device:
            logging.warning(f"[SUB] Токен не найден: {token}")
            return web.Response(status=404, text="Subscription not found")
        
        device_uuid, device_name = device
        
        # Генерируем M3U контент
        m3u_content = generate_m3u_content(device_uuid, device_name)
        
        # Возвращаем M3U с правильными заголовками
        return web.Response(
            text=m3u_content,
            content_type='application/vnd.apple.mpegurl; charset=utf-8',
            headers={
                'Content-Disposition': 'inline; filename="subscription.m3u"'
            }
        )
    
    except Exception as e:
        logging.error(f"[SUB] Ошибка обработки подписки: {e}")
        return web.Response(status=500, text="Server error")

async def run_yoomoney_webhook():
    """
    Запускает асинхронный веб-сервер для вебхуков ЮMoney и подписок
    """
    app = web.Application()
    
    # 1. Основной путь для реальных уведомлений от ЮMoney (метод POST)
    app.router.add_post(YOOMONEY_WEBHOOK_PATH, yoomoney_webhook_handler)
    
    # 2. Endpoint для подписок (метод GET) - /sub/{token}
    app.router.add_get('/sub/{token}', subscription_handler)
    
    # Внутренняя функция для теста
    async def test_payment_handler(request: web.Request) -> web.Response:
        """Тестовый эндпоинт для проверки платежа (защищённый secret token)"""
        try:
            query = request.query
            secret = query.get("secret", "")
            tg_id = query.get("tg_id", "")
            months = query.get("months", "1")
            
            # Проверяем secret token
            if secret != YOOMONEY_TEST_SECRET:
                logging.warning(f"Test payment attempt with wrong secret: {secret}")
                return web.Response(status=403, text="ERROR: Invalid secret token")
            
            if not tg_id.isdigit() or not months.isdigit():
                return web.Response(status=400, text="Invalid parameters: need tg_id and months as numbers")
            
            tg_id = int(tg_id)
            months = int(months)
            operation_id = f"test_{int(time.time())}"
            
            logging.info(f"Test payment triggered: tg_id={tg_id}, months={months}")
            
            # ВНИМАНИЕ: Убедись, что сумма передается корректно. 
            # Для теста передаем условные 99 (за 1 месяц)
            test_amount = 99.0 if months == 1 else 249.0
            success = await process_yoomoney_payment(tg_id, test_amount, operation_id)
            
            if success:
                return web.Response(status=200, text=f"OK: Payment processed for user {tg_id}")
            else:
                return web.Response(status=500, text=f"ERROR: Failed to process payment for user {tg_id}")
        except Exception as e:
            logging.error(f"Test payment error: {e}")
            return web.Response(status=500, text=str(e))

    # 2. Регистрируем тестовый путь (метод GET), чтобы он открывался в браузере
    app.router.add_get("/yoomoney/test", test_payment_handler)
    
    runner = web.AppRunner(app)
    await runner.setup()
    
    # СЛУШАЕМ НА 0.0.0.0 — это критически важно для доступа извне!
    site = web.TCPSite(runner, "0.0.0.0", YOOMONEY_WEBHOOK_PORT)
    await site.start()
    
    # Используем твой SERVER_IP для красивого вывода в логи
    display_ip = SERVER_IP 
    
    logging.info(f"YooMoney webhook server started on port {YOOMONEY_WEBHOOK_PORT}")
    logging.info(f"Webhook URL for YooMoney: http://{display_ip}:{YOOMONEY_WEBHOOK_PORT}{YOOMONEY_WEBHOOK_PATH}")
    logging.info(f"Test link: http://{display_ip}:{YOOMONEY_WEBHOOK_PORT}/yoomoney/test?secret={YOOMONEY_TEST_SECRET}&tg_id={ADMIN_ID}&months=1")

class PromoState(StatesGroup):
    waiting_for_promo = State()

class AddDeviceState(StatesGroup):
    waiting_for_name = State()

class DeleteDeviceState(StatesGroup):
    waiting_for_index = State()

@dp.callback_query(F.data == "enter_promo")
async def enter_promo_call(call: CallbackQuery, state: FSMContext):
    await call.message.edit_text("🎁 <b>Введите промокод для VPN (дни):</b>\n\n📌 Пример: VPN-ABC123", 
                               reply_markup=InlineKeyboardBuilder().button(text="🔙 Отмена", callback_data="back_to_main").as_markup(),
                               parse_mode="HTML")
    await state.set_state(PromoState.waiting_for_promo)

@dp.callback_query(F.data == "enter_device_promo")
async def enter_device_promo_call(call: CallbackQuery, state: FSMContext):
    await call.message.edit_text("📱 <b>Введите промокод для добавления устройства:</b>\n\n📌 Пример: DEV-XYZ789", 
                               reply_markup=InlineKeyboardBuilder().button(text="🔙 Отмена", callback_data="back_to_main").as_markup(),
                               parse_mode="HTML")
    await state.set_state(PromoState.waiting_for_promo)

@dp.message(PromoState.waiting_for_promo)
async def process_promo(message: Message, state: FSMContext):
    code = message.text.strip().upper()
    
    # Валидация ввода
    if not code or len(code) > 30 or not all(c.isalnum() or c == '-' for c in code):
        msg = await message.answer("❌ <b>Ошибка:</b> Некорректный формат кода.\n\n📌 Используйте буквы, цифры и дефис.", parse_mode="HTML")
        asyncio.create_task(delete_after(msg, 10))
        return
    
    # Удаляем входящее сообщение пользователя
    try: 
        await message.delete()
    except TelegramBadRequest:
        pass
    except Exception as e:
        logging.warning(f"Delete message error: {e}")
    
    tg_id = message.from_user.id
    user = db("SELECT expiry, is_active FROM users WHERE tg_id=?", (tg_id,), fetch=True)
    
    if not user:
        msg = await message.answer("❌ Ошибка: Пользователь не найден. Используйте /start", parse_mode="HTML")
        await state.clear()
        return
    
    current_time = time.time()
    exp, active = user
    res_text = "❌ <b>Ошибка:</b> Промокод неверен, истек или полностью использован."
    
    # Проверяем VPN промокод
    sub_promo = db("SELECT days, usage_limit, current_usage FROM promos WHERE code=?", (code,), fetch=True)
    if sub_promo and sub_promo[2] < sub_promo[1]:
        days = sub_promo[0]
        new_exp = max(exp, current_time) + (days * 24 * 3600)
        
        devices = get_user_devices(tg_id)
        
        if not devices:
            # Создаем первое устройство
            if create_device(tg_id, "Устройство 1", new_exp * 1000):
                db("UPDATE users SET expiry=?, is_active=1 WHERE tg_id=?", (new_exp, tg_id))
                db("UPDATE promos SET current_usage = current_usage + 1 WHERE code=?", (code,))
                res_text = f"✅ <b>Успешно!</b>\n📅 Активировано: <b>{days}</b> дней"
            else:
                res_text = "⚠️ <b>Ошибка:</b> Не удалось создать ключ. Обратитесь в поддержку."
        else:
            # Обновляем срок для существующих
            if update_all_devices_expiry(tg_id, new_exp * 1000):
                db("UPDATE users SET expiry=?, is_active=1 WHERE tg_id=?", (new_exp, tg_id))
                db("UPDATE promos SET current_usage = current_usage + 1 WHERE code=?", (code,))
                res_text = f"✅ <b>Успешно!</b>\n📅 Продлено на: <b>{days}</b> дней"
            else:
                res_text = "⚠️ <b>Ошибка:</b> Не удалось обновить ключи. Обратитесь в поддержку."
    else:
        # Проверяем Device промокод (добавление устройства)
        dev_promo = db("SELECT usage_limit, current_usage FROM device_promos WHERE code=?", (code,), fetch=True)
        if dev_promo and dev_promo[1] < dev_promo[0]:
            devices = get_user_devices(tg_id)
            if len(devices) >= 5:
                res_text = "❌ <b>Ошибка:</b> Максимум 5 устройств на подписку"
            else:
                new_name = f"Устройство {len(devices) + 1}"
                if create_device(tg_id, new_name, exp * 1000):
                    db("UPDATE device_promos SET current_usage = current_usage + 1 WHERE code=?", (code,))
                    res_text = f"✅ <b>Успешно!</b>\n📱 Добавлено устройство: <b>{new_name}</b>"
                else:
                    res_text = "⚠️ <b>Ошибка:</b> Не удалось добавить устройство"
    
    msg = await message.answer(res_text, parse_mode="HTML")
    asyncio.create_task(delete_after(msg, 15))
    await state.clear()

# ================= DEVICE MANAGEMENT HANDLERS =================
@dp.callback_query(F.data == "select_device_copy")
async def select_device_copy_call(call: CallbackQuery, state: FSMContext):
    """Показывает список устройств для копирования ссылки подписки"""
    try:
        tg_id = call.from_user.id
        devices = get_user_devices(tg_id)
        
        if not devices:
            await call.answer("❌ Нет устройств", show_alert=True)
            return
        
        text = (f"📋 <b>Выберите устройство для копирования ссылки подписки</b>\n"
                f"{SEPARATOR}\n\n")
        
        for i, dev in enumerate(devices, 1):
            dev_status = "✅" if dev['expiry'] > time.time() else "⏳"
            dev_date = datetime.fromtimestamp(dev['expiry']).strftime('%d.%m') if dev['expiry'] > time.time() else "истек"
            text += f"{dev_status} <b>#{i}. {dev['name']}</b> ({dev_date})\n"
        
        kb = InlineKeyboardBuilder()
        for i in range(1, len(devices) + 1):
            kb.button(text=f"📋 Копировать #{i}", callback_data=f"confirm_copy_device:{i-1}")
        kb.button(text="🔙 Отмена", callback_data="profile")
        kb.adjust(1)
        
        await call.message.edit_text(text, reply_markup=kb.as_markup(), parse_mode="HTML")
    except Exception as e:
        logging.error(f"Select device copy error: {e}")
        await call.answer("❌ Ошибка", show_alert=True)

@dp.callback_query(F.data.startswith("confirm_copy_device:"))
async def confirm_copy_device_call(call: CallbackQuery):
    """Копирует ссылку подписки выбранного устройства (только URL)"""
    try:
        device_index = int(call.data.split(":")[1])
        tg_id = call.from_user.id
        devices = get_user_devices(tg_id)
        
        if not devices or device_index >= len(devices) or device_index < 0:
            await call.answer("❌ Устройство не найдено", show_alert=True)
            return
        
        subscription_url = generate_subscription_url(devices[device_index]['subscription_token'])
        
        text = (f"✅ <b>Ссылка подписки скопирована!</b>\n\n"
                f"<code>{subscription_url}</code>\n\n"
                f"💡 Вставьте ее в приложение (v2rayNG, Streisand и т.д.)")
        
        msg = await call.message.answer(text, parse_mode="HTML")
        asyncio.create_task(delete_after(msg, 20))
        await call.answer("✅ Ссылка подписки готова к использованию")
    except Exception as e:
        logging.error(f"Copy device error: {e}")
        await call.answer("❌ Ошибка", show_alert=True)

@dp.callback_query(F.data == "select_device_replace")
async def select_device_replace_call(call: CallbackQuery, state: FSMContext):
    """Показывает список устройств для замены"""
    try:
        tg_id = call.from_user.id
        devices = get_user_devices(tg_id)
        
        if not devices:
            await call.answer("❌ Нет устройств", show_alert=True)
            return
        
        text = (f"🔄 <b>Выберите устройство для замены ключа</b>\n"
                f"{SEPARATOR}\n\n")
        
        for i, dev in enumerate(devices, 1):
            dev_status = "✅" if dev['expiry'] > time.time() else "⏳"
            dev_date = datetime.fromtimestamp(dev['expiry']).strftime('%d.%m') if dev['expiry'] > time.time() else "истек"
            text += f"{dev_status} <b>#{i}. {dev['name']}</b> ({dev_date})\n"
        
        kb = InlineKeyboardBuilder()
        for i in range(1, len(devices) + 1):
            kb.button(text=f"🔄 Заменить #{i}", callback_data=f"confirm_replace_device:{i-1}")
        kb.button(text="🔙 Отмена", callback_data="profile")
        kb.adjust(1)
        
        await call.message.edit_text(text, reply_markup=kb.as_markup(), parse_mode="HTML")
    except Exception as e:
        logging.error(f"Select device replace error: {e}")
        await call.answer("❌ Ошибка", show_alert=True)

@dp.callback_query(F.data.startswith("confirm_replace_device:"))
async def confirm_replace_device_call(call: CallbackQuery):
    """Заменяет выбранное устройство на новое"""
    try:
        device_index = int(call.data.split(":")[1])
        tg_id = call.from_user.id
        user = db("SELECT expiry FROM users WHERE tg_id=?", (tg_id,), fetch=True)
        devices = get_user_devices(tg_id)
        
        if not devices or device_index >= len(devices) or device_index < 0 or not user:
            await call.answer("❌ Устройство не найдено", show_alert=True)
            return
        
        old_uuid = devices[device_index]['uuid']
        old_name = devices[device_index]['name']
        exp = user[0]
        
        # Удаляем старый ключ
        if delete_device(tg_id, old_uuid):
            # Создаем новый
            if create_device(tg_id, old_name, exp * 1000):
                text = (f"✅ <b>Ключ успешно заменен!</b>\n\n"
                        f"🗝️ Старый ключ удален с сервера\n"
                        f"✨ Создан новый\n\n"
                        f"📱 Откройте профиль для получения нового ключа")
                msg = await call.message.answer(text, parse_mode="HTML")
                asyncio.create_task(delete_after(msg, 20))
            else:
                text = "⚠️ <b>Ошибка:</b> Не удалось создать новый ключ"
                msg = await call.message.answer(text, parse_mode="HTML")
        else:
            text = "⚠️ <b>Ошибка:</b> Не удалось удалить старый ключ с сервера"
            msg = await call.message.answer(text, parse_mode="HTML")
        
        await call.answer()
    except Exception as e:
        logging.error(f"Replace device error: {e}")
        await call.answer("❌ Ошибка при замене ключа", show_alert=True)

@dp.callback_query(F.data == "select_device_delete")
async def select_device_delete_call(call: CallbackQuery, state: FSMContext):
    """Показывает список устройств для удаления"""
    try:
        tg_id = call.from_user.id
        devices = get_user_devices(tg_id)
        
        if not devices:
            await call.answer("❌ Нет устройств", show_alert=True)
            return
        
        if len(devices) == 1:
            await call.answer("❌ Нельзя удалить последнее устройство", show_alert=True)
            return
        
        text = (f"🗑️ <b>Выберите устройство для удаления</b>\n"
                f"{SEPARATOR}\n\n")
        
        for i, dev in enumerate(devices, 1):
            dev_status = "✅" if dev['expiry'] > time.time() else "⏳"
            dev_date = datetime.fromtimestamp(dev['expiry']).strftime('%d.%m') if dev['expiry'] > time.time() else "истек"
            text += f"{dev_status} <b>#{i}. {dev['name']}</b> (до {dev_date})\n"
        
        kb = InlineKeyboardBuilder()
        for i in range(1, len(devices) + 1):
            kb.button(text=f"🗑️ Удалить #{i}", callback_data=f"confirm_delete_device:{i-1}")
        kb.button(text="🔙 Отмена", callback_data="profile")
        kb.adjust(1)
        
        await call.message.edit_text(text, reply_markup=kb.as_markup(), parse_mode="HTML")
    except Exception as e:
        logging.error(f"Select device delete error: {e}")
        await call.answer("❌ Ошибка", show_alert=True)

@dp.callback_query(F.data.startswith("confirm_delete_device:"))
async def confirm_delete_device_call(call: CallbackQuery):
    """Удаляет выбранное устройство"""
    try:
        device_index = int(call.data.split(":")[1])
        tg_id = call.from_user.id
        devices = get_user_devices(tg_id)
        
        if not devices or device_index >= len(devices) or device_index < 0:
            await call.answer("❌ Устройство не найдено", show_alert=True)
            return
        
        if len(devices) == 1:
            await call.answer("❌ Нельзя удалить последнее устройство", show_alert=True)
            return
        
        device_uuid = devices[device_index]['uuid']
        device_name = devices[device_index]['name']
        
        if delete_device(tg_id, device_uuid):
            text = (f"✅ <b>Устройство удалено!</b>\n\n"
                    f"🗑️ Ключ '<b>{device_name}</b>' удален\n"
                    f"📊 Осталось: <code>{len(devices) - 1}</code> устройств")
            msg = await call.message.answer(text, parse_mode="HTML")
            asyncio.create_task(delete_after(msg, 15))
        else:
            text = "⚠️ <b>Ошибка:</b> Не удалось удалить устройство"
            msg = await call.message.answer(text, parse_mode="HTML")
        
        await call.answer()
    except Exception as e:
        logging.error(f"Confirm delete device error: {e}")
        await call.answer("❌ Ошибка при удалении", show_alert=True)

@dp.callback_query(F.data == "add_device")
async def add_device_call(call: CallbackQuery, state: FSMContext):
    """Добавляет новое устройство"""
    try:
        tg_id = call.from_user.id
        devices = get_user_devices(tg_id)
        
        if len(devices) >= 5:
            await call.answer("❌ Максимум 5 устройств на подписку", show_alert=True)
            return
        
        text = (f"📱 <b>Добавление нового устройства</b>\n\n"
                f"Введите название для устройства\n"
                f"📌 Примеры: <code>iPhone</code>, <code>Samsung</code>, <code>MacBook</code>\n\n"
                f"Осталось слотов: <code>{5 - len(devices)}</code>")
        
        await call.message.edit_text(text, 
                                    reply_markup=InlineKeyboardBuilder().button(text="🔙 Отмена", callback_data="profile").as_markup(),
                                    parse_mode="HTML")
        await state.set_state(AddDeviceState.waiting_for_name)
    except Exception as e:
        logging.error(f"Add device call error: {e}")
        await call.answer("❌ Ошибка", show_alert=True)

@dp.message(AddDeviceState.waiting_for_name)
async def add_device_name_step(message: Message, state: FSMContext):
    """Завершает добавление устройства"""
    try:
        device_name = message.text.strip()
        
        # Удаляем входящее сообщение пользователя
        try:
            await message.delete()
        except:
            pass
        
        # Валидация
        if not device_name or len(device_name) > 20:
            msg = await message.answer("❌ Название должно быть от 1 до 20 символов", parse_mode="HTML")
            asyncio.create_task(delete_after(msg, 5))
            return
        
        tg_id = message.from_user.id
        user = db("SELECT expiry FROM users WHERE tg_id=?", (tg_id,), fetch=True)
        
        if not user:
            await message.answer("❌ Ошибка: Пользователь не найден", parse_mode="HTML")
            await state.clear()
            return
        
        exp = user[0]
        
        if create_device(tg_id, device_name, exp * 1000):
            text = (f"✅ <b>Устройство добавлено!</b>\n\n"
                    f"📱 <b>Название:</b> {device_name}\n"
                    f"⏳ <b>Действительно до:</b> <code>{datetime.fromtimestamp(exp).strftime('%d.%m.%Y')}</code>\n\n"
                    f"🔑 Откройте профиль для получения ключа")
            msg = await message.answer(text, parse_mode="HTML")
        else:
            text = "⚠️ <b>Ошибка:</b> Не удалось создать устройство"
            msg = await message.answer(text, parse_mode="HTML")
        
        asyncio.create_task(delete_after(msg, 15))
        await state.clear()
    except Exception as e:
        logging.error(f"Add device name step error: {e}")
        await message.answer("❌ Ошибка при добавлении устройства", parse_mode="HTML")
        await state.clear()

# ================= ADMIN HANDLERS =================
class AdminPromoState(StatesGroup):
    waiting_for_days = State()
    waiting_for_limit = State()

class AdminDevicePromoState(StatesGroup):
    waiting_for_limit = State()

class AdminDelPromoState(StatesGroup):
    waiting_for_code = State()

class AdminSubState(StatesGroup):
    waiting_for_tg_id = State()
    waiting_for_days = State()

class AdminRemoveSubState(StatesGroup):
    waiting_for_tg_id = State()

class AdminBroadcastState(StatesGroup):
    waiting_for_text = State()

@dp.callback_query(F.data == "admin_panel")
async def admin_panel_call(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: 
        await call.answer("❌ Доступ запрещен", show_alert=True)
        return
    await state.clear()
    text = (f"🛠️ <b>Админ-панель</b>\n"
            f"{SEPARATOR}\n"
            f"Управление ботом и промокодами")
    try: 
        await call.message.edit_text(text, reply_markup=admin_kb(), parse_mode="HTML")
    except TelegramBadRequest: 
        await call.answer()

@dp.callback_query(F.data == "create_promo")
async def create_promo_call(call: CallbackQuery, state: FSMContext):
    text = ("📝 <b>Создание промокода VPN</b>\n\n"
            "Введите количество дней подписки (число)\n"
            "📌 Пример: <code>30</code> (для 30 дней)")
    await call.message.edit_text(text, reply_markup=InlineKeyboardBuilder().button(text="🔙 Отмена", callback_data="admin_panel").as_markup(), parse_mode="HTML")
    await state.set_state(AdminPromoState.waiting_for_days)

@dp.message(AdminPromoState.waiting_for_days)
async def promo_days_step(message: Message, state: FSMContext):
    try:
        await message.delete()
    except:
        pass
    
    if not message.text.isdigit():
        msg = await message.answer("❌ Введите число (цифры)")
        asyncio.create_task(delete_after(msg, 5))
        return
    
    await state.update_data(days=int(message.text))
    text = ("📝 <b>Введите лимит активаций</b>\n\n"
            "Сколько раз можно использовать этот код?\n"
            "📌 Пример: <code>5</code> (для 5 пользователей)")
    await message.answer(text, parse_mode="HTML")
    await state.set_state(AdminPromoState.waiting_for_limit)

@dp.message(AdminPromoState.waiting_for_limit)
async def promo_limit_step(message: Message, state: FSMContext):
    try:
        await message.delete()
    except:
        pass
    
    if not message.text.isdigit():
        msg = await message.answer("❌ Введите число (цифры)")
        asyncio.create_task(delete_after(msg, 5))
        return
    
    limit = int(message.text)
    data = await state.get_data()
    code = f"VPN-{generate_random_string(6).upper()}"
    db("INSERT INTO promos (code, days, usage_limit) VALUES (?, ?, ?)", (code, data['days'], limit))
    
    text = (f"✅ <b>Промокод создан!</b>\n"
            f"{SEPARATOR}\n"
            f"📌 <b>Код:</b> <code>{code}</code>\n"
            f"📅 <b>Дней:</b> <code>{data['days']}</code>\n"
            f"👥 <b>Лимит:</b> <code>{limit}</code> использований")
    await message.answer(text, reply_markup=admin_kb(), parse_mode="HTML")
    await state.clear()

@dp.callback_query(F.data == "create_device_promo")
async def create_dev_promo_call(call: CallbackQuery, state: FSMContext):
    text = ("📝 <b>Создание промокода на устройство</b>\n\n"
            "Введите лимит активаций (число)\n"
            "📌 Пример: <code>10</code> (для 10 пользователей)")
    await call.message.edit_text(text, reply_markup=InlineKeyboardBuilder().button(text="🔙 Отмена", callback_data="admin_panel").as_markup(), parse_mode="HTML")
    await state.set_state(AdminDevicePromoState.waiting_for_limit)

@dp.message(AdminDevicePromoState.waiting_for_limit)
async def dev_promo_limit_step(message: Message, state: FSMContext):
    try:
        await message.delete()
    except:
        pass
    
    if not message.text.isdigit():
        msg = await message.answer("❌ Введите число (цифры)")
        asyncio.create_task(delete_after(msg, 5))
        return
    
    limit = int(message.text)
    code = f"DEV-{generate_random_string(6).upper()}"
    db("INSERT INTO device_promos (code, usage_limit) VALUES (?, ?)", (code, limit))
    
    text = (f"✅ <b>Промокод на устройство создан!</b>\n"
            f"{SEPARATOR}\n"
            f"📌 <b>Код:</b> <code>{code}</code>\n"
            f"📱 <b>Эффект:</b> +1 устройство\n"
            f"👥 <b>Лимит:</b> <code>{limit}</code> использований")
    await message.answer(text, reply_markup=admin_kb(), parse_mode="HTML")
    await state.clear()

@dp.callback_query(F.data == "delete_promo")
async def del_promo_call(call: CallbackQuery, state: FSMContext):
    text = "🗑️ <b>Удаление промокода</b>\n\nВведите код для удаления"
    await call.message.edit_text(text, reply_markup=InlineKeyboardBuilder().button(text="🔙 Отмена", callback_data="admin_panel").as_markup(), parse_mode="HTML")
    await state.set_state(AdminDelPromoState.waiting_for_code)

@dp.message(AdminDelPromoState.waiting_for_code)
async def del_promo_step(message: Message, state: FSMContext):
    try:
        await message.delete()
    except:
        pass
    
    code = message.text.strip().upper()
    
    vpn_deleted = db("DELETE FROM promos WHERE code=?", (code,))
    dev_deleted = db("DELETE FROM device_promos WHERE code=?", (code,))
    
    if vpn_deleted or dev_deleted:
        text = (f"✅ <b>Промокод удален!</b>\n"
                f"{SEPARATOR}\n"
                f"📌 <b>Код:</b> <code>{code}</code>")
    else:
        text = (f"⚠️ <b>Промокод не найден</b>\n"
                f"Проверьте правильность кода: <code>{code}</code>")
    
    await message.answer(text, reply_markup=admin_kb(), parse_mode="HTML")
    await state.clear()

@dp.callback_query(F.data == "admin_add_sub")
async def admin_add_sub_call(call: CallbackQuery, state: FSMContext):
    text = ("✅ <b>Выдать подписку пользователю</b>\n\n"
            "Введите Telegram ID пользователя\n"
            "📌 Пример: <code>1234567890</code>")
    await call.message.edit_text(text, reply_markup=InlineKeyboardBuilder().button(text="🔙 Отмена", callback_data="admin_panel").as_markup(), parse_mode="HTML")
    await state.set_state(AdminSubState.waiting_for_tg_id)

@dp.message(AdminSubState.waiting_for_tg_id)
async def admin_sub_tg_id_step(message: Message, state: FSMContext):
    try:
        await message.delete()
    except:
        pass
    
    if not message.text.isdigit():
        msg = await message.answer("❌ Введите корректный Telegram ID (только цифры)")
        asyncio.create_task(delete_after(msg, 5))
        return
    
    tg_id = int(message.text)
    user = db("SELECT * FROM users WHERE tg_id=?", (tg_id,), fetch=True)
    
    if not user:
        db("INSERT INTO users (tg_id, expiry, is_active) VALUES (?, ?, 0)", (tg_id, time.time()))
    
    await state.update_data(tg_id=tg_id)
    text = ("Введите количество дней подписки\n"
            "📌 Пример: <code>30</code>")
    await message.answer(text, parse_mode="HTML")
    await state.set_state(AdminSubState.waiting_for_days)

@dp.message(AdminSubState.waiting_for_days)
async def admin_sub_days_step(message: Message, state: FSMContext):
    try:
        await message.delete()
    except:
        pass
    
    if not message.text.isdigit():
        msg = await message.answer("❌ Введите число (цифры)")
        asyncio.create_task(delete_after(msg, 5))
        return
    
    days = int(message.text)
    data = await state.get_data()
    tg_id = data['tg_id']
    
    # Обновляем подписку
    current_time = time.time()
    existing_user = db("SELECT expiry FROM users WHERE tg_id=?", (tg_id,), fetch=True)
    
    if existing_user:
        new_exp = max(existing_user[0], current_time) + (days * 24 * 3600)
    else:
        new_exp = current_time + (days * 24 * 3600)
    
    db("UPDATE users SET expiry=?, is_active=1 WHERE tg_id=?", (new_exp, tg_id))
    
    # Если есть устройства - обновляем их срок
    devices = db("SELECT device_uuid FROM devices WHERE tg_id=?", (tg_id,), all=True)
    if devices:
        update_all_devices_expiry(tg_id, new_exp * 1000)
    
    text = (f"✅ <b>Подписка выдана!</b>\n"
            f"{SEPARATOR}\n"
            f"👤 <b>Пользователь:</b> <code>{tg_id}</code>\n"
            f"📅 <b>На:</b> <code>{days}</code> дней\n"
            f"⏳ <b>До:</b> <code>{datetime.fromtimestamp(new_exp).strftime('%d.%m.%Y')}</code>")
    await message.answer(text, reply_markup=admin_kb(), parse_mode="HTML")
    await state.clear()

@dp.callback_query(F.data == "admin_remove_sub")
async def admin_remove_sub_call(call: CallbackQuery, state: FSMContext):
    text = ("❌ <b>Удалить подписку пользователя</b>\n\n"
            "Введите Telegram ID пользователя\n"
            "📌 Пример: <code>1234567890</code>")
    await call.message.edit_text(text, reply_markup=InlineKeyboardBuilder().button(text="🔙 Отмена", callback_data="admin_panel").as_markup(), parse_mode="HTML")
    await state.set_state(AdminRemoveSubState.waiting_for_tg_id)

@dp.message(AdminRemoveSubState.waiting_for_tg_id)
async def admin_remove_sub_tg_id_step(message: Message, state: FSMContext):
    try:
        await message.delete()
    except:
        pass
    
    if not message.text.isdigit():
        msg = await message.answer("❌ Введите корректный Telegram ID (только цифры)")
        asyncio.create_task(delete_after(msg, 5))
        return
    
    tg_id = int(message.text)
    user = db("SELECT expiry, is_active FROM users WHERE tg_id=?", (tg_id,), fetch=True)
    
    if not user:
        msg = await message.answer("❌ Пользователь не найден в БД")
        asyncio.create_task(delete_after(msg, 5))
        await state.clear()
        return
    
    exp, active = user
    
    # Удаляем подписку
    db("UPDATE users SET expiry=?, is_active=0 WHERE tg_id=?", (time.time(), tg_id))
    
    # Деактивируем все устройства
    devices = db("SELECT device_uuid FROM devices WHERE tg_id=?", (tg_id,), all=True)
    for (uuid_str,) in devices:
        update_client_status(VLESS_INBOUND_ID, uuid_str, False)
    
    text = (f"✅ <b>Подписка удалена!</b>\n"
            f"{SEPARATOR}\n"
            f"👤 <b>Пользователь:</b> <code>{tg_id}</code>\n"
            f"📵 Все {len(devices)} устройств(а) деактивированы")
    await message.answer(text, parse_mode="HTML")
    await state.clear()

@dp.callback_query(F.data == "admin_broadcast")
async def admin_broadcast_start(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID:
        await call.answer("❌ Доступ запрещен", show_alert=True)
        return
    text = (
        "📢 <b>Оповещение всем пользователям</b>\n\n"
        "Отправьте одно сообщение с текстом — его получат все пользователи из базы бота "
        "(кто хотя бы раз нажал /start).\n\n"
        "<i>Если в Telegram включено форматирование, оно сохранится. "
        "Максимум 4096 символов.</i>"
    )
    await call.message.edit_text(
        text,
        reply_markup=InlineKeyboardBuilder().button(text="🔙 Отмена", callback_data="admin_panel").as_markup(),
        parse_mode="HTML",
    )
    await state.set_state(AdminBroadcastState.waiting_for_text)
    await call.answer()

@dp.message(AdminBroadcastState.waiting_for_text)
async def admin_broadcast_send(message: Message, state: FSMContext):
    if message.from_user.id != ADMIN_ID:
        return
    try:
        await message.delete()
    except Exception:
        pass

    if not message.text:
        msg = await message.answer("❌ Отправьте текстовое сообщение")
        asyncio.create_task(delete_after(msg, 5))
        return

    use_html = bool(message.entities)
    body = message.html_text if use_html else message.text
    if not str(body).strip():
        msg = await message.answer("❌ Нужен непустой текст")
        asyncio.create_task(delete_after(msg, 5))
        return

    if len(body) > 4096:
        msg = await message.answer("❌ Слишком длинно (макс. 4096 символов)")
        asyncio.create_task(delete_after(msg, 6))
        return

    rows = db("SELECT tg_id FROM users", all=True) or []
    ok, fail = 0, 0

    for (tid,) in rows:
        try:
            if use_html:
                await bot.send_message(tid, body, parse_mode="HTML")
            else:
                await bot.send_message(tid, body)
            ok += 1
            await asyncio.sleep(0.035)
        except TelegramForbiddenError:
            fail += 1
        except TelegramRetryAfter as e:
            await asyncio.sleep(e.retry_after)
            try:
                if use_html:
                    await bot.send_message(tid, body, parse_mode="HTML")
                else:
                    await bot.send_message(tid, body)
                ok += 1
            except Exception:
                fail += 1
        except Exception as e:
            logging.warning(f"Broadcast to {tid} failed: {e}")
            fail += 1

    await state.clear()
    report = (
        f"✅ <b>Рассылка завершена</b>\n{SEPARATOR}\n"
        f"Доставлено: <b>{ok}</b>\n"
        f"Не доставлено (блок / ошибка): <b>{fail}</b>\n"
        f"Всего в базе: <b>{len(rows)}</b>"
    )
    await message.answer(report, reply_markup=admin_kb(), parse_mode="HTML")

@dp.callback_query(F.data == "users_list")
async def users_list_call(call: CallbackQuery):
    try:
        rows = db("SELECT tg_id, expiry, is_active FROM users ORDER BY expiry DESC LIMIT 20", all=True)
        text = f"👥 <b>Активные пользователи (макс. 20)</b>\n{SEPARATOR}\n"
        
        active_count = sum(1 for _, exp, act in rows if act == 1 and exp > time.time())
        text += f"🟢 Активно: <b>{active_count}</b> | 🔴 Неактивно: <b>{len(rows) - active_count}</b>\n{SEPARATOR}\n"
        
        for i, (tid, exp, act) in enumerate(rows, 1):
            st = "🟢" if act == 1 and exp > time.time() else "🔴"
            exp_str = datetime.fromtimestamp(exp).strftime('%d.%m') if exp > time.time() else "истек"
            text += f"{st} <code>{tid}</code> - {exp_str}\n"
        
        try: await call.message.edit_text(text, parse_mode="HTML", reply_markup=admin_kb())
        except TelegramBadRequest: await call.answer()
    except Exception as e:
        logging.error(f"Users list error: {e}")
        await call.answer("❌ Ошибка загрузки списка", show_alert=True)

@dp.callback_query(F.data == "promo_list")
async def promo_list_call(call: CallbackQuery):
    try:
        p1 = db("SELECT code, days, current_usage, usage_limit FROM promos", all=True)
        p2 = db("SELECT code, current_usage, usage_limit FROM device_promos", all=True)
        
        text = f"📋 <b>Активные промокоды</b>\n{SEPARATOR}\n"
        
        if p1:
            text += "🔹 <b>VPN (дни):</b>\n"
            for c, d, u, l in p1:
                progress = "✅" if u >= l else f"{u}/{l}"
                text += f"  <code>{c}</code> ({d}д) — {progress}\n"
        
        if p2:
            text += "\n📱 <b>Устройства (+1):</b>\n"
            for c, u, l in p2:
                progress = "✅" if u >= l else f"{u}/{l}"
                text += f"  <code>{c}</code> — {progress}\n"
        
        if not p1 and not p2:
            text += "<i>Промокодов нет</i>"
        
        try: 
            await call.message.edit_text(text, reply_markup=admin_kb(), parse_mode="HTML")
        except TelegramBadRequest: 
            await call.answer()
    except Exception as e:
        logging.error(f"Promo list error: {e}")
        await call.answer("❌ Ошибка загрузки промокодов", show_alert=True)

async def check_expiry():
    while True:
        try:
            curr = time.time()
            expired_users = db("SELECT tg_id FROM users WHERE expiry < ? AND is_active = 1", (curr,), all=True)
            
            for (tid,) in expired_users:
                # Получаем все устройства пользователя
                devices = db("SELECT device_uuid FROM devices WHERE tg_id=?", (tid,), all=True)
                
                # Деактивируем на панели
                for (uuid_str,) in devices:
                    if update_client_status(VLESS_INBOUND_ID, uuid_str, False):
                        logging.info(f"Disabled device {uuid_str} for user {tid}")
                    else:
                        logging.warning(f"Failed to disable device {uuid_str} for user {tid}")
                
                # Обновляем в БД
                db("UPDATE users SET is_active=0 WHERE tg_id=?", (tid,))
                
                # Уведомляем пользователя
                try:
                    await bot.send_message(tid, "⚠️ <b>Срок подписки истек</b>\n\n🔄 Продлите подписку, чтобы продолжить пользоваться VPN", parse_mode="HTML")
                except TelegramForbiddenError:
                    logging.warning(f"User {tid} blocked the bot")
                except TelegramRetryAfter as e:
                    logging.warning(f"Rate limit: retry after {e.retry_after}s")
                    await asyncio.sleep(e.retry_after)
                except Exception as e:
                    logging.warning(f"Failed to notify user {tid}: {e}")
        except Exception as e:
            logging.error(f"Expiry check error: {e}")
        
        try:
            await asyncio.sleep(3600)
        except Exception:
            pass

async def main():
    init_db()
    asyncio.create_task(check_expiry())
    asyncio.create_task(run_yoomoney_webhook())
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())