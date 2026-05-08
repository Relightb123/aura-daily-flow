import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';
import db from '../db';

const parseMarkdown = (text) => {
  if (!text) return '';
  let html = text
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```[\s\S]*?```/g, (match) => { const code = match.replace(/```\w*\n?/g, '').replace(/```/g, ''); return `<pre><code>${code}</code></pre>`; })
    .replace(/^\* (.*$)/gm, '<li>$1</li>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br>');
  return html;
};

const Notes = ({ user, syncStatus }) => {
  const { t, theme } = useApp();
  const [content, setContent] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const debounceTimer = useRef(null);

  const loadNotes = useCallback(async () => {
    if (!user?.email) return;
    const result = await db.getNotes(user.email);
    if (result.success && result.data !== null) setContent(result.data);
  }, [user?.email]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const saveNotes = async (newContent) => {
    setSyncing(true);
    await db.saveNotes(user.email, newContent);
    syncStatus.current = 'Synced';
    setTimeout(() => { setSyncing(false); syncStatus.current = t('allSynced'); }, 800);
  };

  const handleChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => saveNotes(newContent), 500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className={`p-8 rounded-2xl transition-all duration-300 md:col-span-2 lg:col-span-1 ${
        theme === 'dark' ? 'bg-[rgba(24,24,27,0.7)] border border-[rgba(255,255,255,0.1)]' : 'bg-white/70 border border-[rgba(0,0,0,0.1)]'
      } backdrop-blur-xl`} style={{ gridColumn: '1 / -1' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{t('instantNotes')}</h2>
          {syncing && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-medium bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">{t('syncing')}</motion.span>}
        </div>
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsPreview(false)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${!isPreview ? 'bg-[#6366f1] text-[#fafafa]' : (theme === 'dark' ? 'text-[#94a3b8] hover:text-[#fafafa]' : 'text-[#71717a] hover:text-[#18181b]')}`}>{t('edit')}</motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsPreview(true)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${isPreview ? 'bg-[#6366f1] text-[#fafafa]' : (theme === 'dark' ? 'text-[#94a3b8] hover:text-[#fafafa]' : 'text-[#71717a] hover:text-[#18181b]')}`}>{t('preview')}</motion.button>
        </div>
      </div>

      {isPreview ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`min-h-[150px] p-4 rounded-xl ${theme === 'dark' ? 'bg-[#09090b]/50' : 'bg-black/5'}`}
          dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
        />
      ) : (
        <textarea value={content} onChange={handleChange} placeholder="Jot down your thoughts... (Markdown supported)"
          className={`w-full h-[150px] resize-none ${theme === 'dark' ? 'bg-[#09090b]/80 border-[#27272a] text-[#fafafa] placeholder-[#71717a]' : 'bg-white/80 border-[#e4e4e7] text-[#18181b] placeholder-[#a1a1aa]'}`} />
      )}

      <div className="flex items-center justify-between mt-4">
        <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>
          <Icons.StickyNote className="w-4 h-4" />
          <span>{content.length} {t('characters')}</span>
        </div>
        <div className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>{t('markdownSupported')}</div>
      </div>
    </motion.div>
  );
};

export default Notes;