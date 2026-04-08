import axios from 'axios';
import { getAuthToken, logout } from './auth';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

// Get current frontend URL for QR code generation
export const getFrontendUrl = () => {
  // Use the current window location, stripping trailing slash
  return window.location.origin;
};

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and frontend URL header
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Add frontend URL header for environment-aware QR code generation
    config.headers['x-frontend-url'] = getFrontendUrl();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're on a login/register page (login failure returns 401)
      const isAuthPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
      if (!isAuthPage) {
        logout();
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;