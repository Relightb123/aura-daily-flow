import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Icons from './Icons';

const weatherIcons = {
  sunny: 'Sun',
  cloudy: 'Cloud',
  rainy: 'Rain',
  snowy: 'Snow',
};

const WeatherWidget = () => {
  const { t, theme } = useApp();
  const [weather, setWeather] = useState({ temp: null, condition: 'sunny' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            const response = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
            );
            const data = await response.json();
            if (data.current_weather) {
              const temp = Math.round(data.current_weather.temperature);
              const code = data.current_weather.weathercode;
              let condition = 'sunny';
              if (code >= 61 && code < 80) condition = 'rainy';
              else if (code >= 80) condition = 'cloudy';
              else if (code >= 71 && code < 77) condition = 'snowy';
              setWeather({ temp, condition });
            }
          }, () => {
            setWeather({ temp: null, condition: 'sunny' });
          });
        } else {
          setWeather({ temp: null, condition: 'sunny' });
        }
      } catch (e) {
        setWeather({ temp: null, condition: 'sunny' });
      }
      setLoading(false);
    };
    fetchWeather();
  }, []);

  if (loading) return null;

  const IconComponent = Icons[weatherIcons[weather.condition] || 'Sun'] || Icons.Sun;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
      className={`p-3 rounded-xl flex items-center gap-3 ${
        theme === 'dark' 
          ? 'bg-[rgba(24,24,27,0.5)] border border-[rgba(255,255,255,0.05)]' 
          : 'bg-white/50 border border-[rgba(0,0,0,0.05)]'
      }`}
    >
      <IconComponent className={`w-5 h-5 ${theme === 'dark' ? 'text-[#fbbf24]' : 'text-orange-500'}`} />
      <div>
        {weather.temp !== null ? (
          <p className={`text-sm font-medium ${theme === 'dark' ? 'text-[#fafafa]' : 'text-[#18181b]'}`}>
            {weather.temp}°C
          </p>
        ) : (
          <p className={`text-xs ${theme === 'dark' ? 'text-[#71717a]' : 'text-[#a1a1aa]'}`}>
            {t('locationDisabled') || 'Location disabled'}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default WeatherWidget;