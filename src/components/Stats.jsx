import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';
import db from '../db';

const Stats = ({ user }) => {
  const { t, theme } = useApp();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user?.email) return;
    const result = await db.getStats(user.email);
    if (result.success && result.data) {
      setStats(result.data);
    }
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const formatTime = (minutes) => {
    if (!minutes) return '0ч 0м';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}ч ${mins}м`;
  };

  const statCards = [
    { label: t('focusSessions') || 'Сессий', value: stats?.totalSessions || 0, icon: Icons.Clock, color: 'bg-[#6366f1]/20' },
    { label: t('focusTime') || 'Время фокуса', value: formatTime(stats?.totalFocusTime || 0), icon: Icons.Timer, color: 'bg-[#8b5cf6]/20' },
    { label: t('streak') || 'Серия', value: `${stats?.currentStreak || 0} дней`, icon: Icons.Flame, color: 'bg-orange-500/20' },
    { label: t('bestStreak') || 'Рекорд', value: `${stats?.longestStreak || 0} дней`, icon: Icons.Trophy, color: 'bg-yellow-500/20' },
  ];

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className={`p-6 rounded-2xl transition-all duration-300 ${
        theme === 'dark' ? 'bg-[rgba(24,24,27,0.7)] border border-[rgba(255,255,255,0.1)]' : 'bg-white/70 border border-[rgba(0,0,0,0.1)]'
      } backdrop-blur-xl`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icons.Chart className={`w-5 h-5 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`} />
        <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>
          {t('statistics') || 'Статистика'}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className={`p-4 rounded-xl ${stat.color}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`} />
              <span className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>{stat.label}</span>
            </div>
            <p className={`text-xl font-bold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default Stats;