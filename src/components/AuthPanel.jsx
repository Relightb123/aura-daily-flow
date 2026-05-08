import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';
import db from '../db';

const AuthPanel = ({ isOpen, onClose, onLogin }) => {
  const { t, theme } = useApp();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (mode === 'login') result = await db.login(email, password);
      else result = await db.register(name, email, password);
      if (result.success) { onLogin(result.user); onClose(); resetForm(); }
      else { setError(result.error); }
    } catch (err) { setError('An error occurred. Please try again.'); }
    finally { setLoading(false); }
  };

  const resetForm = () => { setName(''); setEmail(''); setPassword(''); setError(''); };
  const switchMode = () => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
          <motion.div initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-0 bottom-0 w-full max-w-md z-50 shadow-2xl flex flex-col ${
              theme === 'dark' ? 'bg-[#09090b]' : 'bg-[#fafafa]'
            }`}>
            <div className="flex justify-end p-6">
              <button onClick={onClose} className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-[#18181b]' : 'hover:bg-[#e4e4e7]'}`}>
                <Icons.X className={`w-6 h-6 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`} />
              </button>
            </div>

            <div className="flex-1 px-8 pb-8">
              <motion.div key={mode} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>
                  {mode === 'login' ? t('welcomeBack') : t('createAccount')}
                </h2>
                <p className={`mb-8 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>
                  {mode === 'login' ? t('signInDesc') : t('signUpDesc')}
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {mode === 'register' && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#a1a1aa]' : 'text-[#52525b]'}`}>{t('name')}</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('enterName')}
                        className={`w-full ${theme === 'dark' ? 'bg-[#18181b] border-[#27272a] text-[#fafafa] placeholder-[#71717a]' : 'bg-white border-[#e4e4e7] text-[#18181b] placeholder-[#a1a1aa]'}`} required />
                    </div>
                  )}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#a1a1aa]' : 'text-[#52525b]'}`}>{t('email')}</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('enterEmail')}
                      className={`w-full ${theme === 'dark' ? 'bg-[#18181b] border-[#27272a] text-[#fafafa] placeholder-[#71717a]' : 'bg-white border-[#e4e4e7] text-[#18181b] placeholder-[#a1a1aa]'}`} required />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#a1a1aa]' : 'text-[#52525b]'}`}>{t('password')}</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('enterPassword')}
                      className={`w-full ${theme === 'dark' ? 'bg-[#18181b] border-[#27272a] text-[#fafafa] placeholder-[#71717a]' : 'bg-white border-[#e4e4e7] text-[#18181b] placeholder-[#a1a1aa]'}`} required minLength={6} />
                  </div>
                  {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm">{error}</motion.p>}
                  <button type="submit" disabled={loading}
                    className="w-full py-4 text-base flex items-center justify-center gap-2 rounded-xl bg-[#6366f1] text-[#fafafa] font-medium hover:bg-[#818CF8] transition-all disabled:opacity-50">
                    {loading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-[#fafafa]/30 border-t-[#fafafa] rounded-full" /> : (mode === 'login' ? t('signIn') : t('signUp'))}
                  </button>
                </form>

                <p className={`mt-8 text-center ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>
                  {mode === 'login' ? t('dontHaveAccount') : t('alreadyHaveAccount')}
                  <button onClick={switchMode} className="ml-2 text-[#6366f1] hover:text-[#818CF8] font-medium transition-colors">
                    {mode === 'login' ? t('signUp') : t('signIn')}
                  </button>
                </p>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AuthPanel;