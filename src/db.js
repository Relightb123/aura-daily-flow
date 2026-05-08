import { Storage, Encryption, RateLimiter, Validator, Security } from './utils/security.js';

const STORAGE_PREFIX = 'aura_';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const generateId = () => Math.random().toString(36).substring(2, 15);

const defaultUserData = {
  tasks: [],
  notes: '',
  hydration: { glasses: 0, lastDate: null, eyeRestLastDate: null },
  timerSettings: { focusDuration: 25 * 60, breakDuration: 5 * 60, mode: 'focus' },
  stats: {
    totalSessions: 0,
    totalFocusTime: 0,
    completedTasks: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null
  }
};

const users = new Map();

export const db = {
  async login(email, password) {
    if (!RateLimiter.check('login_' + email)) {
      return { success: false, error: 'Too many attempts. Please try again later.' };
    }

    if (!Security.validateEmail(email)) {
      return { success: false, error: 'Invalid email format' };
    }

    await delay(600);

    const safeEmail = email.toLowerCase().trim();
    const user = users.get(safeEmail);
    
    if (user && user.password === password) {
      const token = Encryption.generateToken();
      user.token = token;
      user.lastLogin = Date.now();
      
      Storage.set(`user_session_${safeEmail}`, { 
        email: safeEmail, 
        token, 
        timestamp: Date.now() 
      });
      
      RateLimiter.reset('login_' + email);
      
      return { 
        success: true, 
        user: { email: user.email, name: user.name, token } 
      };
    }
    
    if (user) {
      return { success: false, error: 'Invalid password' };
    }
    
    return { success: false, error: 'User not found' };
  },

  async register(name, email, password) {
    if (!RateLimiter.check('register_' + email)) {
      return { success: false, error: 'Too many attempts. Please try again later.' };
    }

    if (!Security.validateName(name)) {
      return { success: false, error: 'Invalid name format' };
    }

    if (!Security.validateEmail(email)) {
      return { success: false, error: 'Invalid email format' };
    }

    if (!Security.validatePassword(password)) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    await delay(800);

    const safeEmail = email.toLowerCase().trim();
    const safeName = Security.sanitizeInput(name).slice(0, 100);
    
    if (users.has(safeEmail)) {
      return { success: false, error: 'Email already registered' };
    }

    const user = {
      id: generateId(),
      name: safeName,
      email: safeEmail,
      password,
      createdAt: Date.now(),
      lastLogin: Date.now()
    };

    users.set(safeEmail, { ...user, ...defaultUserData });

    const token = Encryption.generateToken();
    user.token = token;

    Storage.set(`user_session_${safeEmail}`, { 
      email: safeEmail, 
      token, 
      timestamp: Date.now() 
    });

    RateLimiter.reset('register_' + email);

    return { 
      success: true, 
      user: { email: user.email, name: user.name, token } 
    };
  },

  async logout() {
    await delay(200);
    const session = Storage.get('user_session_current');
    if (session) {
      Storage.remove(`user_session_${session.email}`);
      Storage.remove('user_session_current');
    }
    return { success: true };
  },

  async getCurrentUser() {
    const session = Storage.get('user_session_current');
    if (!session) return null;

    try {
      const { email, token } = session;
      const stored = Storage.get(`user_session_${email}`);
      
      if (stored && stored.token === token) {
        const userData = users.get(email);
        if (userData && userData.token === token) {
          return { email: userData.email, name: userData.name, token };
        }
      }
    } catch (e) {
      Storage.remove('user_session_current');
    }
    return null;
  },

  async syncData(userEmail, dataType, data) {
    await delay(300);

    const user = users.get(userEmail);
    if (!user) return { success: false, error: 'User not found' };

    const key = `${STORAGE_PREFIX}${dataType}_${userEmail}`;
    Storage.set(key, {
      data,
      timestamp: Date.now(),
      synced: true,
      version: '1.0'
    });

    return { success: true, timestamp: Date.now() };
  },

  async getData(userEmail, dataType) {
    await delay(200);

    const key = `${STORAGE_PREFIX}${dataType}_${userEmail}`;
    const stored = Storage.get(key);

    if (stored && stored.data !== undefined) {
      return { success: true, data: stored.data };
    }

    const user = users.get(userEmail);
    if (user && user[dataType] !== undefined) {
      return { success: true, data: user[dataType] };
    }

    return { success: true, data: null };
  },

  async saveTasks(userEmail, tasks) {
    const user = users.get(userEmail);
    if (user) {
      user.tasks = tasks.map(Validator.sanitizeTask);
    }
    return this.syncData(userEmail, 'tasks', user?.tasks || []);
  },

  async getTasks(userEmail) {
    return this.getData(userEmail, 'tasks');
  },

  async saveNotes(userEmail, notes) {
    const user = users.get(userEmail);
    if (user) {
      user.notes = Validator.sanitizeNote(notes);
    }
    return this.syncData(userEmail, 'notes', user?.notes || '');
  },

  async getNotes(userEmail) {
    return this.getData(userEmail, 'notes');
  },

  async saveHydration(userEmail, hydration) {
    const user = users.get(userEmail);
    if (user) {
      user.hydration = Validator.sanitizeHydration(hydration);
    }
    return this.syncData(userEmail, 'hydration', user?.hydration || { glasses: 0 });
  },

  async getHydration(userEmail) {
    return this.getData(userEmail, 'hydration');
  },

  async saveTimerSettings(userEmail, settings) {
    const user = users.get(userEmail);
    if (user) {
      user.timerSettings = {
        focusDuration: Math.min(3600, Math.max(60, Number(settings.focusDuration) || 1500)),
        breakDuration: Math.min(1800, Math.max(60, Number(settings.breakDuration) || 300)),
        mode: ['focus', 'break'].includes(settings.mode) ? settings.mode : 'focus'
      };
    }
    return this.syncData(userEmail, 'timerSettings', user?.timerSettings || {});
  },

  async getTimerSettings(userEmail) {
    return this.getData(userEmail, 'timerSettings');
  },

  async saveStats(userEmail, stats) {
    const user = users.get(userEmail);
    if (user) {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      if (stats.totalSessions > (user.stats?.totalSessions || 0)) {
        stats.lastActiveDate = today;
        if (user.stats?.lastActiveDate === yesterday) {
          stats.currentStreak = (user.stats?.currentStreak || 0) + 1;
        } else if (user.stats?.lastActiveDate !== today) {
          stats.currentStreak = 1;
        }
        if (stats.currentStreak > (user.stats?.longestStreak || 0)) {
          stats.longestStreak = stats.currentStreak;
        }
      }
      
      user.stats = { ...user.stats, ...stats };
    }
    return this.syncData(userEmail, 'stats', user?.stats || {});
  },

  async getStats(userEmail) {
    return this.getData(userEmail, 'stats');
  },

  async incrementSession(userEmail) {
    const user = users.get(userEmail);
    if (!user) return { success: false };
    
    const stats = user.stats || { totalSessions: 0, totalFocusTime: 0, completedTasks: 0, currentStreak: 0, longestStreak: 0, lastActiveDate: null };
    stats.totalSessions += 1;
    
    return this.saveStats(userEmail, stats);
  },

  async addFocusTime(userEmail, minutes) {
    const user = users.get(userEmail);
    if (!user) return { success: false };
    
    const stats = user.stats || { totalSessions: 0, totalFocusTime: 0, completedTasks: 0, currentStreak: 0, longestStreak: 0, lastActiveDate: null };
    stats.totalFocusTime += minutes;
    
    return this.saveStats(userEmail, stats);
  },

  async exportUserData(userEmail) {
    const tasks = await this.getTasks(userEmail);
    const notes = await this.getNotes(userEmail);
    const hydration = await this.getHydration(userEmail);
    const timerSettings = await this.getTimerSettings(userEmail);
    const stats = await this.getStats(userEmail);

    return {
      success: true,
      data: {
        exportDate: new Date().toISOString(),
        tasks: tasks.data,
        notes: notes.data,
        hydration: hydration.data,
        timerSettings: timerSettings.data,
        stats: stats.data
      }
    };
  },

  async deleteAccount(userEmail) {
    users.delete(userEmail);
    Storage.remove(`user_session_${userEmail}`);
    Storage.remove(`${STORAGE_PREFIX}tasks_${userEmail}`);
    Storage.remove(`${STORAGE_PREFIX}notes_${userEmail}`);
    Storage.remove(`${STORAGE_PREFIX}hydration_${userEmail}`);
    Storage.remove(`${STORAGE_PREFIX}timerSettings_${userEmail}`);
    Storage.remove(`${STORAGE_PREFIX}stats_${userEmail}`);
    return { success: true };
  }
};

export default db;