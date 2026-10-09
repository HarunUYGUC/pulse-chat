import axios from 'axios';

const resolveApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    const raw = import.meta.env.VITE_API_URL.trim();
    return raw.endsWith('/api') ? raw : `${raw.replace(/\/+$/, '')}/api`;
  }

  if (typeof window !== 'undefined') {
    // In local Vite dev environment (port 5173 / localhost)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return window.location.port === '5173' ? '/api' : 'http://localhost:5000/api';
    }
    // In production on any custom domain / cloud host
    return '/api';
  }

  return 'http://localhost:5000/api';
};

export const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pulsechat_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pulsechat_token');
      localStorage.removeItem('pulsechat_user');
    }
    return Promise.reject(error);
  }
);

export default api;
