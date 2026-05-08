import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary, LoadingScreen } from './components/ErrorBoundary';
import db from './db';
import Icons from './components/Icons';
import AuthPanel from './components/AuthPanel';
import UserSidebar from './components/UserSidebar';
import Timer from './components/Timer';
import Tasks from './components/Tasks';
import Notes from './components/Notes';
import Hydration from './components/Hydration';
import Stats from './components/Stats';
import Particles from './components/Particles';
import QuoteCard from './components/QuoteCard';
import Achievements from './components/Achievements';
import WeatherWidget from './components/WeatherWidget';
import QuickLinks from './components/QuickLinks';

function AppContent() {
  const { t, theme, toggleTheme, language, toggleLanguage } = useApp();
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timerCompleted, setTimerCompleted] = useState(false);
  const syncStatusRef = useRef('All data synced');

  useEffect(() => {
    const initUser = async () => {
      const currentUser = await db.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
    };
    initUser();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  const formatDate = () => {
    const date = new Date();
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', options);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`min-h-screen p-6 md:p-8 lg:p-12 transition-colors duration-300 relative overflow-hidden ${
      theme === 'dark' ? 'bg-[#09090b]' : 'bg-[#fafafa]'
    }`}>
      <Particles />
      <div className="max-w-[1400px] mx-auto relative z-10">
        <header className="mb-8 flex justify-between items-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-[28px] font-semibold ${
              theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'
            }`}
          >
            {t('appName')}
          </motion.h1>

          <div className="flex items-center gap-3">
            <WeatherWidget />
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleLanguage}
              className={`p-2 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-[#18181b] border-[#27272a] text-[#94a3b8] hover:border-[#6366f1]'
                  : 'bg-white border-[#e4e4e7] text-[#71717a] hover:border-[#6366f1]'
              }`}
              title={t('language')}
            >
              <span className="text-xs font-bold">{language.toUpperCase()}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-[#18181b] border-[#27272a] text-[#94a3b8] hover:border-[#6366f1]'
                  : 'bg-white border-[#e4e4e7] text-[#71717a] hover:border-[#6366f1]'
              }`}
              title={t('theme')}
            >
              {theme === 'dark' ? (
                <Icons.Moon className="w-5 h-5" />
              ) : (
                <Icons.Sun className="w-5 h-5" />
              )}
            </motion.button>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                theme === 'dark'
                  ? 'bg-[#18181b]/50 border-[rgba(255,255,255,0.1)]'
                  : 'bg-white/50 border-[rgba(0,0,0,0.1)]'
              }`}
            >
              <Icons.CloudSync className="w-4 h-4 text-[#6366f1]" />
              <span className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>
                {syncStatusRef.current}
              </span>
            </motion.div>

            {user ? (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSidebarOpen(true)}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${
                  theme === 'dark'
                    ? 'bg-[#18181b] border-[rgba(255,255,255,0.1)] hover:border-[#6366f1]/30'
                    : 'bg-white border-[#e4e4e7] hover:border-[#6366f1]/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#6366f1]">
                    {getInitials(user.name)}
                  </span>
                </div>
                <span className={`text-sm font-medium hidden md:block ${
                  theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'
                }`}>
                  {user.name}
                </span>
                <Icons.Menu className={`w-4 h-4 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`} />
              </motion.button>
            ) : (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAuthOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#6366f1] text-[#fafafa] font-medium text-sm hover:bg-[#818CF8] transition-all"
              >
                {t('signIn')}
              </motion.button>
            )}
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-sm mb-8 ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}
        >
          {formatDate()}
        </motion.div>

        {user ? (
          <main className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <div className="md:col-span-2 lg:col-span-2">
              <Timer
                user={user}
                isCompleted={timerCompleted}
                setIsCompleted={setTimerCompleted}
              />
            </div>
            <Stats user={user} />
            <Tasks user={user} syncStatus={syncStatusRef} />
            <Hydration user={user} syncStatus={syncStatusRef} />
            <Notes user={user} syncStatus={syncStatusRef} />
            <QuoteCard user={user} />
            <Achievements user={user} />
            <div className="md:col-span-2 lg:col-span-1">
              <QuickLinks />
            </div>
          </main>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-24 h-24 rounded-3xl bg-[#6366f1]/20 flex items-center justify-center mb-6"
            >
              <Icons.Clock className="w-12 h-12 text-[#6366f1]" />
            </motion.div>
            <h2 className={`text-2xl font-bold mb-3 ${
              theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'
            }`}>
              {t('welcome')}
            </h2>
            <p className={`mb-8 max-w-md ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-[#71717a]'}`}>
              {t('welcomeDesc')}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAuthOpen(true)}
              className="px-8 py-4 rounded-xl bg-[#6366f1] text-[#fafafa] font-semibold text-lg hover:bg-[#818CF8] transition-all"
            >
              {t('getStarted')}
            </motion.button>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {authOpen && (
          <AuthPanel
            isOpen={authOpen}
            onClose={() => setAuthOpen(false)}
            onLogin={(userData) => setUser(userData)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sidebarOpen && (
          <UserSidebar
            user={user}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onLogout={() => setUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;