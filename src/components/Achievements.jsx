import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';
import db from '../db';

const achievements = [
  { id: 'first_task', name: { en: 'First Step', ru: 'Первый шаг' }, desc: { en: 'Complete your first task', ru: 'Выполни первую задачу' }, icon: 'Rocket', requirement: (s) => (s?.completedTasks || 0) >= 1 },
  { id: 'five_tasks', name: { en: 'Getting Started', ru: 'В начале пути' }, desc: { en: 'Complete 5 tasks', ru: 'Выполни 5 задач' }, icon: 'CheckCircle', requirement: (s) => (s?.completedTasks || 0) >= 5 },
  { id: 'ten_tasks', name: { en: 'Productivity Pro', ru: 'Профессионал' }, desc: { en: 'Complete 10 tasks', ru: 'Выполни 10 задач' }, icon: 'Trophy', requirement: (s) => (s?.completedTasks || 0) >= 10 },
  { id: 'first_session', name: { en: 'Focus Beginner', ru: 'Начинающий' }, desc: { en: 'Complete first focus session', ru: 'Заверши первую сессию' }, icon: 'Clock', requirement: (s) => (s?.totalSessions || 0) >= 1 },
  { id: 'five_sessions', name: { en: 'Focus Master', ru: 'Мастер фокуса' }, desc: { en: 'Complete 5 focus sessions', ru: 'Заверши 5 сессий' }, icon: 'Flame', requirement: (s) => (s?.totalSessions || 0) >= 5 },
  { id: 'ten_sessions', name: { en: 'Focus Legend', ru: 'Легенда' }, desc: { en: 'Complete 10 focus sessions', ru: 'Заверши 10 сессий' }, icon: 'Sparkles', requirement: (s) => (s?.totalSessions || 0) >= 10 },
  { id: 'one_hour', name: { en: 'Time Invested', ru: 'Инвестиция времени' }, desc: { en: 'Focus for 1 hour total', ru: 'Сфокусируйся на 1 час' }, icon: 'Timer', requirement: (s) => (s?.totalFocusTime || 0) >= 60 },
  { id: 'five_hours', name: { en: 'Deep Work', ru: 'Глубокая работа' }, desc: { en: 'Focus for 5 hours total', ru: 'Сфокусируйся на 5 часов' }, icon: 'Chart', requirement: (s) => (s?.totalFocusTime || 0) >= 300 },
  { id: 'streak_3', name: { en: 'Consistent', ru: 'Постоянство' }, desc: { en: '3-day streak', ru: 'Серия 3 дня' }, icon: 'Flame', requirement: (s) => (s?.currentStreak || 0) >= 3 },
  { id: 'streak_7', name: { en: 'Weekly Warrior', ru: 'Воин недели' }, desc: { en: '7-day streak', ru: 'Серия 7 дней' }, icon: 'Trophy', requirement: (s) => (s?.currentStreak || 0) >= 7 },
];

const Achievements = ({ user }) => {
  const { t, theme, language } = useApp();
  const [stats, setStats] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);

  const loadStats = useCallback(async () => {
    if (!user?.email) return;
    const result = await db.getStats(user.email);
    if (result.success && result.data) {
      setStats(result.data);
    }
  }, [user?.email]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const unlockedAchievements = achievements.filter(a => a.requirement(stats));
  const lockedAchievements = achievements.filter(a => !a.requirement(stats));

  if (!stats) return null;

  const displayAchievements = showAll ? achievements : unlockedAchievements.slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className={`p-6 rounded-2xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-[rgba(24,24,27,0.7)] border border-[rgba(255,255,255,0.1)]' 
          : 'bg-white/70 border border-[rgba(0,0,0,0.1)]'
      } backdrop-blur-xl`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icons.Trophy className={`w-5 h-5 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`} />
          <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>
            {t('achievements') || 'Achievements'}
          </h2>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${
          theme === 'dark' ? 'bg-[#6366f1]/20 text-[#818CF8]' : 'bg-purple-100 text-purple-600'
        }`}>
          {unlockedAchievements.length}/{achievements.length}
        </span>
      </div>

      <div className="space-y-2">
        {displayAchievements.map((achievement, index) => {
          const IconComponent = Icons[achievement.icon] || Icons.Trophy;
          return (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                theme === 'dark' ? 'bg-[#09090b]/50' : 'bg-black/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                theme === 'dark' ? 'bg-[#6366f1]/20' : 'bg-purple-100'
              }`}>
                <IconComponent className={`w-5 h-5 ${theme === 'dark' ? 'text-[#818CF8]' : 'text-purple-600'}`} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>
                  {achievement.name[language] || achievement.name.en}
                </p>
                <p className={`text-xs ${theme === 'dark' ? 'text-[#71717a]' : 'text-[#a1a1aa]'}`}>
                  {achievement.desc[language] || achievement.desc.en}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {!showAll && lockedAchievements.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={() => setShowAll(true)}
          className={`w-full mt-3 py-2 text-sm rounded-xl border transition-all ${
            theme === 'dark' 
              ? 'border-[rgba(255,255,255,0.1)] text-[#94a3b8] hover:border-[#6366f1]/50 hover:text-[#fafafa]' 
              : 'border-[#e4e4e7] text-[#71717a] hover:border-purple-300 hover:text-purple-600'
          }`}
        >
          {t('viewLocked') || `View ${lockedAchievements.length} locked`}
        </motion.button>
      )}

      {showAll && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowAll(false)}
          className={`w-full mt-3 py-2 text-sm rounded-xl border transition-all ${
            theme === 'dark' 
              ? 'border-[rgba(255,255,255,0.1)] text-[#94a3b8] hover:border-[#6366f1]/50 hover:text-[#fafafa]' 
              : 'border-[#e4e4e7] text-[#71717a] hover:border-purple-300 hover:text-purple-600'
          }`}
        >
          {t('showLess') || 'Show less'}
        </motion.button>
      )}
    </motion.div>
  );
};

export default Achievements;