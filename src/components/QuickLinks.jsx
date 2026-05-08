import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';

const links = [
  { id: 'github', name: 'GitHub', url: 'https://github.com', icon: 'GitBranch' },
  { id: 'gmail', name: 'Gmail', url: 'https://gmail.com', icon: 'Mail' },
  { id: 'calendar', name: 'Calendar', url: 'https://calendar.google.com', icon: 'Calendar' },
  { id: 'docs', name: 'Docs', url: 'https://docs.google.com', icon: 'FileText' },
];

const QuickLinks = () => {
  const { t, theme } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative">
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${
          theme === 'dark' 
            ? 'bg-[rgba(24,24,27,0.7)] border border-[rgba(255,255,255,0.1)] hover:border-[#6366f1]/30' 
            : 'bg-white/70 border border-[rgba(0,0,0,0.1)] hover:border-purple-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <Icons.LinkIcon className={`w-4 h-4 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`} />
          <span className={`text-sm font-medium ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>
            {t('quickLinks') || 'Quick Links'}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Icons.ChevronDown className={`w-4 h-4 ${theme === 'dark' ? 'text-[#71717a]' : 'text-[#a1a1aa]'}`} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-2"
          >
            <div className={`p-3 rounded-xl space-y-2 ${
              theme === 'dark' ? 'bg-[#09090b]/80' : 'bg-white/80'
            }`}>
              {links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    theme === 'dark' 
                      ? 'hover:bg-[#18181b] text-[#94a3b8] hover:text-[#fafafa]' 
                      : 'hover:bg-black/5 text-[#71717a] hover:text-[#18181b]'
                  }`}
                >
                  <Icons.ExternalLink className="w-4 h-4" />
                  <span className="text-sm">{link.name}</span>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuickLinks;