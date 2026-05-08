import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';

const pomodoroPresets = [
  { name: { en: 'Classic', ru: 'Классика' }, focus: 25, break: 5, icon: 'Clock' },
  { name: { en: 'Deep Work', ru: 'Глубокая работа' }, focus: 50, break: 10, icon: 'Timer' },
  { name: { en: 'Quick', ru: 'Быстрый' }, focus: 15, break: 3, icon: 'Sparkles' },
  { name: { en: 'Extended', ru: 'Расширенный' }, focus: 90, break: 20, icon: 'Chart' },
];

const PomodoroPresets = ({ currentFocus, currentBreak, onSelect }) => {
  const { t, theme, language } = useApp();
  const [hoveredPreset, setHoveredPreset] = useState(null);

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={`text-xs ${theme === 'dark' ? 'text-[#71717a]' : 'text-[#a1a1aa]'}`}>
        {t('presets') || 'Presets:'} 
      </span>
      <div className="flex gap-2">
        {pomodoroPresets.map((preset) => {
          const IconComponent = Icons[preset.icon] || Icons.Clock;
          const isActive = currentFocus === preset.focus * 60 && currentBreak === preset.break * 60;
          return (
            <motion.button
              key={preset.name.en}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(preset.focus * 60, preset.break * 60)}
              onMouseEnter={() => setHoveredPreset(preset.name.en)}
              onMouseLeave={() => setHoveredPreset(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#6366f1] text-[#fafafa]'
                  : theme === 'dark'
                    ? 'bg-[#18181b] border border-[#27272a] text-[#94a3b8] hover:border-[#6366f1]'
                    : 'bg-white border border-[#e4e4e7] text-[#71717a] hover:border-purple-300'
              }`}
            >
              <IconComponent className="w-3 h-3" />
              {preset.name[language] || preset.name.en}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default PomodoroPresets;