import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';
import db from '../db';

const Tasks = ({ user, syncStatus }) => {
  const { t, theme } = useApp();
  const [tasks, setTasks] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [syncing, setSyncing] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!user?.email) return;
    const result = await db.getTasks(user.email);
    if (result.success && result.data) {
      const cleaned = cleanOldTasks(result.data);
      setTasks(cleaned);
    }
  }, [user?.email]);

  const cleanOldTasks = (taskList) => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    return taskList.filter((task) => {
      if (task.completed && task.completedAt) return now - task.completedAt < DAY_MS;
      return true;
    });
  };

  const saveTasks = async (newTasks) => {
    setSyncing(true);
    await db.saveTasks(user.email, newTasks);
    syncStatus.current = 'Synced';
    setTimeout(() => { setSyncing(false); syncStatus.current = t('allSynced'); }, 1000);
  };

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const addTask = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;
    const newTask = { id: Date.now().toString(), text: inputValue.trim(), completed: false, createdAt: Date.now(), completedAt: null };
    const newTasks = [newTask, ...tasks];
    setTasks(newTasks);
    setInputValue('');
    await saveTasks(newTasks);
  };

  const toggleTask = async (id) => {
    const newTasks = tasks.map(task => task.id === id ? {...task, completed: !task.completed, completedAt: !task.completed ? Date.now() : null} : task);
    setTasks(newTasks);
    await saveTasks(newTasks);
  };

  const deleteTask = async (id) => {
    const newTasks = tasks.filter(task => task.id !== id);
    setTasks(newTasks);
    await saveTasks(newTasks);
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 20 } };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className={`p-8 rounded-2xl transition-all duration-300 ${
        theme === 'dark' ? 'bg-[rgba(24,24,27,0.7)] border border-[rgba(255,255,255,0.1)]' : 'bg-white/70 border border-[rgba(0,0,0,0.1)]'
      } backdrop-blur-xl`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{t('quickTasks')}</h2>
        {syncing && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-medium bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">{t('syncing')}</motion.span>}
      </div>

      <form onSubmit={addTask} className="flex gap-3 mb-4">
        <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={t('addTask')}
          className={`flex-1 ${theme === 'dark' ? 'bg-[#09090b]/80 border-[#27272a] text-[#fafafa] placeholder-[#71717a]' : 'bg-white/80 border-[#e4e4e7] text-[#18181b] placeholder-[#a1a1aa]'}`} />
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit"
          className="px-4 py-2 rounded-xl bg-[#6366f1] text-[#fafafa] hover:bg-[#818CF8] transition-all">
          <Icons.Plus className="w-5 h-5" />
        </motion.button>
      </form>

      <AnimatePresence mode="popLayout">
        {tasks.length === 0 ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-sm text-center py-4 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>
            {t('noTasks')}
          </motion.p>
        ) : (
          <motion.ul variants={containerVariants} initial="hidden" animate="visible" className="space-y-3 max-h-[250px] overflow-y-auto">
            {tasks.map(task => (
              <motion.li key={task.id} variants={itemVariants} layout
                className={`flex items-center gap-3 p-3 rounded-lg group ${theme === 'dark' ? 'bg-[#09090b]/50' : 'bg-black/5'}`}>
                <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)}
                  className="w-5 h-5 rounded-md border-2 border-[#27272a] checked:bg-[#6366f1] checked:border-[#6366f1] cursor-pointer" />
                <span className={`flex-1 text-sm ${task.completed ? (theme === 'dark' ? 'text-[#94a3b8] line-through' : 'text-[#a1a1aa] line-through') : (theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]')}`}>
                  {task.text}
                </span>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icons.Trash className={`w-4 h-4 ${theme === 'dark' ? 'text-[#94a3b8] hover:text-red-400' : 'text-[#71717a] hover:text-red-500'}`} />
                </motion.button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Tasks;