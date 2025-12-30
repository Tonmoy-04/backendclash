import axios from 'axios';

const FALLBACK_API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';

const api = axios.create({
  baseURL: FALLBACK_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

let apiInitialized = false;

export async function initApiBaseUrl() {
  if (apiInitialized) return api;
  apiInitialized = true;

  try {
    // Only available in Electron context (preload exposes window.electronAPI).
    const info = await window?.electronAPI?.backend?.getInfo?.();
    if (info && typeof info.apiBaseUrl === 'string' && info.apiBaseUrl) {
      api.defaults.baseURL = info.apiBaseUrl;
    }
  } catch {
    // Keep fallback baseURL.
  }

  return api;
}

const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    const method = (response?.config?.method || '').toLowerCase();
    if (MUTATING_METHODS.includes(method)) {
      window.dispatchEvent(new CustomEvent('inventory-data-changed'));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
