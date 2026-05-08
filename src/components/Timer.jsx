import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';
import db from '../db';

const Timer = ({ user, isCompleted, setIsCompleted }) => {
  const { t, theme } = useApp();
  const [focusDuration, setFocusDuration] = useState(25 * 60);
  const [breakDuration, setBreakDuration] = useState(5 * 60);
  const [currentTime, setCurrentTime] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('focus');
  const [ambientSounds, setAmbientSounds] = useState({ rain: false, forest: false, white: false });
  const [audioContext, setAudioContext] = useState(null);
  const [sources, setSources] = useState({});

  const circumference = 2 * Math.PI * 90;

  const loadSettings = useCallback(async () => {
    if (!user?.email) return;
    const result = await db.getTimerSettings(user.email);
    if (result.success && result.data) {
      setFocusDuration(result.data.focusDuration || 25 * 60);
      setBreakDuration(result.data.breakDuration || 5 * 60);
      setMode(result.data.mode || 'focus');
      setCurrentTime(result.data.mode === 'focus' 
        ? (result.data.focusDuration || 25 * 60) 
        : (result.data.breakDuration || 5 * 60));
    }
  }, [user?.email]);

  const saveSettings = useCallback(async () => {
    if (!user?.email) return;
    await db.saveTimerSettings(user.email, {
      focusDuration,
      breakDuration,
      mode
    });
  }, [user?.email, focusDuration, breakDuration, mode]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let interval;
    if (isRunning && currentTime > 0) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev <= 1) {
            completeSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, currentTime]);

  const completeSession = () => {
    setIsRunning(false);
    setIsCompleted(true);
    playNotification();
    const newMode = mode === 'focus' ? 'break' : 'focus';
    const newDuration = newMode === 'focus' ? focusDuration : breakDuration;
    setMode(newMode);
    setCurrentTime(newDuration);
    saveSettings();
    setTimeout(() => setIsCompleted(false), 3000);
  };

  const playNotification = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  };

  const toggleTimer = () => {
    if (!audioContext) {
      setAudioContext(new (window.AudioContext || window.webkitAudioContext)());
    }
    setIsRunning(!isRunning);
    saveSettings();
  };

  const resetTimer = () => {
    setIsRunning(false);
    setCurrentTime(mode === 'focus' ? focusDuration : breakDuration);
    saveSettings();
  };

  const createNoise = (type, ctx) => {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    } else if (type === 'rain') {
      for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.5;
      for (let i = 0; i < bufferSize; i++) if (Math.random() > 0.99) output[i] *= 3;
    } else if (type === 'forest') {
      for (let i = 0; i < bufferSize; i++) output[i] = Math.sin(i * 0.01) * Math.random() * 0.3;
    }
    return noiseBuffer;
  };

  const toggleAmbientSound = (sound) => {
    if (!audioContext) setAudioContext(new (window.AudioContext || window.webkitAudioContext)());
    const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (sources[sound]) {
      sources[sound].stop();
      setSources(prev => { const n = {...prev}; delete n[sound]; return n; });
      setAmbientSounds(prev => ({ ...prev, [sound]: false }));
    } else {
      if (ctx.state === 'suspended') ctx.resume();
      const buffer = createNoise(sound, ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.3;
      const filter = ctx.createBiquadFilter();
      if (sound === 'rain') { filter.type = 'lowpass'; filter.frequency.value = 1000; }
      else if (sound === 'forest') { filter.type = 'bandpass'; filter.frequency.value = 500; }
      else { filter.type = 'lowpass'; filter.frequency.value = 4000; }
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start();
      setSources(prev => ({ ...prev, [sound]: source }));
      setAmbientSounds(prev => ({ ...prev, [sound]: true }));
    }
  };

  const maxTime = mode === 'focus' ? focusDuration : breakDuration;
  const progress = (currentTime / maxTime) * circumference;
  const minutes = Math.floor(currentTime / 60);
  const seconds = currentTime % 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-8 rounded-2xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-[rgba(24,24,27,0.7)] border border-[rgba(255,255,255,0.1)]' 
          : 'bg-white/70 border border-[rgba(0,0,0,0.1)]'
      } backdrop-blur-xl ${isCompleted ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>
          {t('focusTimer')}
        </h2>
        <motion.span
          key={mode}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-sm text-[#6366f1] font-medium px-3 py-1 bg-[#6366f1]/10 rounded-full"
        >
          {t(mode)}
        </motion.span>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative w-[200px] h-[200px] mb-6">
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'linear-gradient(-45deg, #6366f1, #8b5cf6, #6366f1, #4f46e5, #6366f1)',
                backgroundSize: '400% 400%',
              }}
              animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
              transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          <svg className="w-full h-full relative z-10" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} strokeWidth="8" />
            <motion.circle
              cx="100" cy="100" r="90" fill="none" stroke="#6366f1" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - progress }}
              style={{ filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <motion.span key={currentTime} initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className={`text-[48px] font-semibold ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </motion.span>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={toggleTimer}
            className="px-6 py-3 rounded-xl bg-[#6366f1] text-[#fafafa] font-medium flex items-center gap-2 hover:bg-[#818CF8] transition-all">
            {isRunning ? <><Icons.Pause className="w-4 h-4" />{t('pause')}</> : <><Icons.Play className="w-4 h-4" />{t('start')}</>}
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={resetTimer}
            className={`px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${
              theme === 'dark' 
                ? 'text-[#a1a1aa] border border-[#27272a] hover:border-[#6366f1] hover:text-[#fafafa]'
                : 'text-[#71717a] border border-[#e4e4e7] hover:border-[#6366f1] hover:text-[#18181b]'
            }`}>
            <Icons.Reset className="w-4 h-4" />{t('reset')}
          </motion.button>
        </div>

        <div className="flex gap-3">
          {[
            { key: 'rain', icon: Icons.Rain, label: 'Rain' },
            { key: 'forest', icon: Icons.Trees, label: 'Forest' },
            { key: 'white', icon: Icons.Wave, label: 'White Noise' },
          ].map(({ key, icon: Icon }) => (
            <motion.button key={key} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => toggleAmbientSound(key)}
              className={`p-2 rounded-lg border transition-all ${
                ambientSounds[key] 
                  ? 'bg-[#6366f1] border-[#6366f1]' 
                  : theme === 'dark'
                    ? 'border-[#27272a] text-[#94a3b8] hover:border-[#6366f1]'
                    : 'border-[#e4e4e7] text-[#71717a] hover:border-[#6366f1]'
              }`}>
              <Icon className={`w-5 h-5 ${ambientSounds[key] ? 'text-[#fafafa]' : ''}`} />
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default Timer;