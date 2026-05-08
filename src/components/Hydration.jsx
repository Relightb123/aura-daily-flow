import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';
import db from '../db';

const Hydration = ({ user, syncStatus }) => {
  const { t, theme } = useApp();
  const [glasses, setGlasses] = useState(0);
  const [lastDate, setLastDate] = useState(null);
  const [eyeRestLastDate, setEyeRestLastDate] = useState(null);
  const [eyeRestCooldown, setEyeRestCooldown] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const eyeRestDuration = 20 * 60;

  const loadHydration = useCallback(async () => {
    if (!user?.email) return;
    const result = await db.getHydration(user.email);
    if (result.success && result.data) {
      const today = new Date().toDateString();
      if (result.data.lastDate !== today) { setGlasses(0); setLastDate(today); }
      else { setGlasses(result.data.glasses || 0); setLastDate(result.data.lastDate); }
      setEyeRestLastDate(result.data.eyeRestLastDate);
      if (result.data.eyeRestLastDate) {
        const elapsed = Date.now() - result.data.eyeRestLastDate;
        if (elapsed < eyeRestDuration * 1000) { setEyeRestCooldown(true); setCooldownTime(Math.floor((eyeRestDuration * 1000 - elapsed) / 1000)); }
      }
    }
  }, [user?.email]);

  useEffect(() => { loadHydration(); }, [loadHydration]);
  useEffect(() => {
    let interval;
    if (eyeRestCooldown && cooldownTime > 0) {
      interval = setInterval(() => { setCooldownTime(prev => { if (prev <= 1) { setEyeRestCooldown(false); return 0; } return prev - 1; }); }, 1000);
    }
    return () => clearInterval(interval);
  }, [eyeRestCooldown, cooldownTime]);

  const saveHydration = async (data) => {
    setSyncing(true);
    await db.saveHydration(user.email, data);
    syncStatus.current = 'Synced';
    setTimeout(() => { setSyncing(false); syncStatus.current = t('allSynced'); }, 800);
  };

  const increment = async () => {
    const newGlasses = Math.min(20, glasses + 1);
    setGlasses(newGlasses);
    const today = new Date().toDateString();
    setLastDate(today);
    await saveHydration({ glasses: newGlasses, lastDate: today, eyeRestLastDate });
  };

  const decrement = async () => {
    const newGlasses = Math.max(0, glasses - 1);
    setGlasses(newGlasses);
    const today = new Date().toDateString();
    setLastDate(today);
    await saveHydration({ glasses: newGlasses, lastDate: today, eyeRestLastDate });
  };

  const startEyeRest = async () => {
    const now = Date.now();
    setEyeRestLastDate(now);
    setEyeRestCooldown(true);
    setCooldownTime(eyeRestDuration);
    const today = new Date().toDateString();
    await saveHydration({ glasses, lastDate: today, eyeRestLastDate: now });
  };

  const formatCooldown = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className={`p-8 rounded-2xl transition-all duration-300 ${
        theme === 'dark' ? 'bg-[rgba(24,24,27,0.7)] border border-[rgba(255,255,255,0.1)]' : 'bg-white/70 border border-[rgba(0,0,0,0.1)]'
      } backdrop-blur-xl`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{t('hydrationWellness')}</h2>
        {syncing && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-medium bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">{t('syncing')}</motion.span>}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.05 }} className="w-10 h-10 rounded-full bg-[#6366f1]/10 flex items-center justify-center">
              <Icons.Droplet className="w-5 h-5 text-[#6366f1]" />
            </motion.div>
            <div>
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{t('waterIntake')}</p>
              <p className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>{t('waterGoal')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={decrement}
              className={`p-2 rounded-lg border transition-all ${theme === 'dark' ? 'border-[#27272a] text-[#94a3b8] hover:border-[#6366f1]' : 'border-[#e4e4e7] text-[#71717a] hover:border-[#6366f1]'}`}>
              <Icons.Plus className="w-4 h-4 rotate-45" />
            </motion.button>
            <motion.span key={glasses} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className={`text-xl font-semibold w-8 text-center ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{glasses}</motion.span>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={increment}
              className={`p-2 rounded-lg border transition-all ${theme === 'dark' ? 'border-[#27272a] text-[#94a3b8] hover:border-[#6366f1]' : 'border-[#e4e4e7] text-[#71717a] hover:border-[#6366f1]'}`}>
              <Icons.Plus className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.05 }} className="w-10 h-10 rounded-full bg-[#6366f1]/10 flex items-center justify-center">
              <Icons.Eye className="w-5 h-5 text-[#6366f1]" />
            </motion.div>
            <div>
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{t('eyeRest')}</p>
              <p className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>{t('eyeRestDuration')}</p>
            </div>
          </div>
          {eyeRestCooldown ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-[#09090b]/50 border-[rgba(255,255,255,0.1)]' : 'bg-black/5 border-[#e4e4e7]'}`}>
              <span className="text-sm text-[#6366f1] font-medium">{formatCooldown(cooldownTime)}</span>
            </motion.div>
          ) : (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={startEyeRest}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                theme === 'dark' ? 'text-[#a1a1aa] border border-[#27272a] hover:border-[#6366f1] hover:text-[#fafafa]' : 'text-[#71717a] border border-[#e4e4e7] hover:border-[#6366f1] hover:text-[#18181b]'
              }`}>{t('restEyes')}</motion.button>
          )}
        </div>

        <AnimatePresence>
          {eyeRestCooldown && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-center py-2">
              <p className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>
                {t('nextBreak')} <span className="text-[#6366f1] font-medium">{formatCooldown(cooldownTime)}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Hydration;