import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';
import db from '../db';

const UserSidebar = ({ user, isOpen, onClose, onLogout }) => {
  const { t, theme } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleLogout = async () => { await db.logout(); onLogout(); onClose(); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await db.exportUserData(user.email);
      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aura-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Export failed:', e);
    }
    setExporting(false);
  };

  const handleDeleteAccount = async () => {
    await db.deleteAccount(user.email);
    onLogout();
    onClose();
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
          <motion.div initial={{ x: '-100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed left-0 top-0 bottom-0 w-80 z-50 flex flex-col ${
              theme === 'dark' ? 'bg-[#18181b] border-r border-[rgba(255,255,255,0.1)]' : 'bg-white border-r border-[#e4e4e7]'
            }`}>
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-[rgba(255,255,255,0.1)]' : 'border-[#e4e4e7]'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{t('profile')}</h3>
                <button onClick={onClose} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-[#09090b]/50' : 'hover:bg-[#f4f4f5]'}`}>
                  <Icons.X className={`w-5 h-5 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-[#6366f1]/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#6366f1]">{getInitials(user?.name)}</span>
                </div>
                <div>
                  <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{user?.name}</p>
                  <p className={`text-sm ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>{user?.email}</p>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-[#09090b]/50 border-[rgba(255,255,255,0.1)]' : 'bg-black/5 border-[#e4e4e7]'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Icons.CloudSync className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>{t('syncStatus')}</p>
                      <p className="text-xs text-green-400">{t('allSynced')}</p>
                    </div>
                  </div>
                </div>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleExport}
                  disabled={exporting}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                    theme === 'dark' ? 'bg-[#09090b]/50 border-[rgba(255,255,255,0.1)] hover:border-[#6366f1]/50' : 'bg-black/5 border-[#e4e4e7] hover:border-[#6366f1]/50'
                  }`}>
                  <div className="w-8 h-8 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#6366f1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>Export Data</p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>Download your data</p>
                  </div>
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowDeleteConfirm(true)}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                    theme === 'dark' ? 'bg-[#09090b]/50 border-red-500/20 hover:border-red-500/50' : 'bg-black/5 border-red-200 hover:border-red-400'
                  }`}>
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-red-400">Delete Account</p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>Remove all data</p>
                  </div>
                </motion.button>
              </motion.div>
            </div>

            <div className={`p-6 border-t ${theme === 'dark' ? 'border-[rgba(255,255,255,0.1)]' : 'border-[#e4e4e7]'}`}>
              <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} onClick={handleLogout}
                className="w-full py-3 px-4 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
                <Icons.Logout className="w-5 h-5" />
                <span className="font-medium">{t('signOut')}</span>
              </motion.button>
            </div>
          </motion.div>

          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-8">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className={`max-w-sm w-full p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#18181b]' : 'bg-white'}`}>
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className={`text-lg font-semibold text-center mb-2 ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>Delete Account?</h3>
                  <p className={`text-sm text-center mb-6 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>This action cannot be undone. All your data will be permanently deleted.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowDeleteConfirm(false)}
                      className={`flex-1 py-2 rounded-xl font-medium transition-all ${
                        theme === 'dark' ? 'text-[#94a3b8] hover:text-[#fafafa] border border-[#27272a]' : 'text-[#71717a] hover:text-[#18181b] border border-[#e4e4e7]'
                      }`}>Cancel</button>
                    <button onClick={handleDeleteAccount}
                      className="flex-1 py-2 rounded-xl bg-red-500 text-[#fafafa] font-medium hover:bg-red-600 transition-all">Delete</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default UserSidebar;