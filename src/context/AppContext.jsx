import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    appName: 'Aura: Daily Flow',
    signIn: 'Sign In',
    getStarted: 'Get Started',
    welcome: 'Welcome to Aura',
    welcomeDesc: 'Your personal daily flow companion. Sign in to sync your tasks, notes, and wellness data across devices.',
    focusTimer: 'Focus Timer',
    focus: 'Focus',
    break: 'Break',
    start: 'Start',
    pause: 'Pause',
    reset: 'Reset',
    quickTasks: 'Quick Tasks',
    addTask: 'Add a task...',
    addTaskBtn: 'Add task',
    noTasks: 'Add a task to stay focused',
    hydrationWellness: 'Hydration & Wellness',
    waterIntake: 'Water Intake',
    waterGoal: 'Goal: 8 glasses',
    eyeRest: 'Eye Rest',
    eyeRestDuration: '20 minute break',
    restEyes: 'Rest Eyes',
    resting: 'Resting...',
    nextBreak: 'Next break available in',
    instantNotes: 'Instant Notes',
    edit: 'Edit',
    preview: 'Preview',
    characters: 'characters',
    markdownSupported: 'Supports **bold**, *italic*, `code`, # headers, - lists',
    profile: 'Profile',
    signOut: 'Sign Out',
    syncStatus: 'Sync Status',
    allSynced: 'All data synced',
    cloudStorage: 'Cloud Storage',
    active: 'Active',
    welcomeBack: 'Welcome back',
    createAccount: 'Create account',
    signInDesc: 'Sign in to access your daily flow',
    signUpDesc: 'Start your journey with Aura',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    enterName: 'Enter your name',
    enterEmail: 'you@example.com',
    enterPassword: 'Enter your password',
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: 'Already have an account?',
    signUp: 'Sign up',
    tasks: 'Tasks',
    settings: 'Settings',
    language: 'Language',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    syncing: 'Syncing...',
    achievements: 'Achievements',
    viewLocked: 'View locked achievements',
    showLess: 'Show less',
    presets: 'Presets:',
    quickLinks: 'Quick Links',
    locationDisabled: 'Location disabled',
    focusSessions: 'Sessions',
    focusTime: 'Focus Time',
    streak: 'Streak',
    bestStreak: 'Best Streak',
    statistics: 'Statistics',
  },
  ru: {
    appName: 'Aura: Ежедневный поток',
    signIn: 'Войти',
    getStarted: 'Начать',
    welcome: 'Добро пожаловать в Aura',
    welcomeDesc: 'Ваш персональный помощник для ежедневных задач. Войдите, чтобы синхронизировать задачи, заметки и данные о здоровье.',
    focusTimer: 'Таймер фокусировки',
    focus: 'Фокус',
    break: 'Перерыв',
    start: 'Старт',
    pause: 'Пауза',
    reset: 'Сброс',
    quickTasks: 'Задачи',
    addTask: 'Добавить задачу...',
    addTaskBtn: 'Добавить',
    noTasks: 'Добавьте задачу для концентрации',
    hydrationWellness: 'Гидратация и здоровье',
    waterIntake: 'Вода',
    waterGoal: 'Цель: 8 стаканов',
    eyeRest: 'Отдых для глаз',
    eyeRestDuration: 'Перерыв 20 минут',
    restEyes: 'Отдохнуть',
    resting: 'Отдыхаю...',
    nextBreak: 'Следующий перерыв через',
    instantNotes: 'Заметки',
    edit: 'Редакт.',
    preview: 'Просмотр',
    characters: 'символов',
    markdownSupported: 'Поддерживает **жирный**, *курсив*, `код`, # заголовки, - списки',
    profile: 'Профиль',
    signOut: 'Выйти',
    syncStatus: 'Статус синхр.',
    allSynced: 'Все синхронизировано',
    cloudStorage: 'Облако',
    active: 'Активно',
    welcomeBack: 'С возвращением',
    createAccount: 'Создать аккаунт',
    signInDesc: 'Войдите для доступа к данным',
    signUpDesc: 'Начните свой путь с Aura',
    name: 'Имя',
    email: 'Email',
    password: 'Пароль',
    enterName: 'Ваше имя',
    enterEmail: 'you@example.com',
    enterPassword: 'Введите пароль',
    dontHaveAccount: 'Нет аккаунта?',
    alreadyHaveAccount: 'Уже есть аккаунт?',
    signUp: 'Регистрация',
    tasks: 'Задачи',
    settings: 'Настройки',
    language: 'Язык',
    theme: 'Тема',
    dark: 'Темная',
    light: 'Светлая',
    syncing: 'Синхр...',
    achievements: 'Достижения',
    viewLocked: 'Показать заблокированные',
    showLess: 'Свернуть',
    presets: 'Пресеты:',
    quickLinks: 'Быстрые ссылки',
    locationDisabled: 'Локация отключена',
    focusSessions: 'Сессий',
    focusTime: 'Время фокуса',
    streak: 'Серия',
    bestStreak: 'Рекорд',
    statistics: 'Статистика',
  }
};

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('aura_theme');
    return saved || 'dark';
  });

  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('aura_language');
    return saved || 'ru';
  });

  useEffect(() => {
    localStorage.setItem('aura_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('aura_language', language);
  }, [language]);

  const t = (key) => translations[language][key] || key;

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'ru' : 'en');

  return (
    <AppContext.Provider value={{ theme, setTheme, language, setLanguage, t, toggleTheme, toggleLanguage }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);