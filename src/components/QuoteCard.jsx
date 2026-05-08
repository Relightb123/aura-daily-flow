import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';

const quotes = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Your limitation—it's only your imagination.", author: "Unknown" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "Победа — это не конечная точка, а направление движения.", author: "Неизвестный" },
  { text: "Успех — это не готовность, а готовность работать.", author: "Неизвестный" },
  { text: "Делай то, что можешь, с тем, что имеешь, и там, где ты есть.", author: "Теодор Рузвельт" },
  { text: "Единственный способ делать великую работу — любить то, что делаешь.", author: "Стив Джобс" },
  { text: "Качество — это не действие, это привычка.", author: "Аристотель" },
];

const QuoteCard = ({ user }) => {
  const { t, theme } = useApp();
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const dailyIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % quotes.length;
    setQuote(quotes[dailyIndex]);
  }, []);

  if (!quote) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`p-6 rounded-2xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-[rgba(99,102,241,0.1)] to-[rgba(139,92,246,0.1)] border border-[rgba(99,102,241,0.2)]' 
          : 'bg-gradient-to-br from-white to-purple-50 border border-purple-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#6366f1]/20 flex items-center justify-center flex-shrink-0 mt-1">
          <Icons.Sparkles className="w-4 h-4 text-[#6366f1]" />
        </div>
        <div className="flex-1">
          <p className={`text-sm leading-relaxed mb-2 ${theme === 'dark' ? 'text-[#e4e4e7]' : 'text-[#3f3f46]'}`}>
            "{quote.text}"
          </p>
          <p className={`text-xs ${theme === 'dark' ? 'text-[#71717a]' : 'text-[#a1a1aa]'}`}>
            — {quote.author}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default QuoteCard;