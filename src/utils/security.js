export const Security = {
  sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim()
      .slice(0, 10000);
  },

  sanitizeHtml(html) {
    if (typeof html !== 'string') return '';
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '')
      .slice(0, 50000);
  },

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  },

  validatePassword(password) {
    return password && password.length >= 6 && password.length <= 128;
  },

  validateName(name) {
    return name && name.length >= 1 && name.length <= 100 && /^[a-zA-Zа-яА-ЯёЁ\s-]+$/.test(name);
  },

  validateTaskText(text) {
    return text && text.length >= 1 && text.length <= 500;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

export const RateLimiter = {
  attempts: {},
  maxAttempts: 5,
  windowMs: 60000,

  check(key) {
    const now = Date.now();
    if (!this.attempts[key]) {
      this.attempts[key] = { count: 0, resetAt: now + this.windowMs };
    }

    if (now > this.attempts[key].resetAt) {
      this.attempts[key] = { count: 0, resetAt: now + this.windowMs };
    }

    this.attempts[key].count++;
    return this.attempts[key].count <= this.maxAttempts;
  },

  reset(key) {
    delete this.attempts[key];
  }
};

export const Encryption = {
  key: 'aura_daily_flow_secure_key_2024',

  generateHash(data) {
    let hash = 0;
    const str = String(data);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  },

  encode(data) {
    try {
      const json = JSON.stringify(data);
      return btoa(unescape(encodeURIComponent(json)));
    } catch (e) {
      return null;
    }
  },

  decode(encoded) {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  },

  generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
};

export const Storage = {
  prefix: 'aura_',

  set(key, value) {
    try {
      const encoded = Encryption.encode(value);
      if (encoded) {
        localStorage.setItem(this.prefix + key, encoded);
        return true;
      }
    } catch (e) {
      console.error('Storage set error:', e);
    }
    return false;
  },

  get(key) {
    try {
      const encoded = localStorage.getItem(this.prefix + key);
      if (encoded) {
        return Encryption.decode(encoded);
      }
    } catch (e) {
      console.error('Storage get error:', e);
    }
    return null;
  },

  remove(key) {
    localStorage.removeItem(this.prefix + key);
  },

  clear() {
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.prefix))
      .forEach(key => localStorage.removeItem(key));
  }
};

export const Validator = {
  isValidUser(user) {
    return user && 
           typeof user.email === 'string' && 
           typeof user.name === 'string' &&
           typeof user.token === 'string';
  },

  sanitizeTask(task) {
    return {
      id: String(task.id).slice(0, 50),
      text: Security.sanitizeInput(task.text).slice(0, 500),
      completed: Boolean(task.completed),
      createdAt: Number(task.createdAt) || Date.now(),
      completedAt: task.completedAt ? Number(task.completedAt) : null
    };
  },

  sanitizeNote(note) {
    return Security.sanitizeHtml(note).slice(0, 50000);
  },

  sanitizeHydration(data) {
    return {
      glasses: Math.min(20, Math.max(0, Number(data.glasses) || 0)),
      lastDate: String(data.lastDate || '').slice(0, 50),
      eyeRestLastDate: data.eyeRestLastDate ? Number(data.eyeRestLastDate) : null
    };
  }
};