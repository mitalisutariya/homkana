import axios from 'axios';

const api = axios.create({
  baseURL: 'https://homkana.onrender.com/api',
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config) => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      const parsed = JSON.parse(userInfo);
      if (parsed.token) {
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = String(error.response?.data?.message || '');
    const isSessionExpired =
      status === 401 &&
      error.config?.headers?.Authorization &&
      /token|jwt|session expired|not authorized, token|user not found/i.test(message);

    if (isSessionExpired) {
      localStorage.removeItem('userInfo');
      const returnPath = window.location.pathname;
      if (window.location.pathname !== '/auth') {
        window.location.href = returnPath && returnPath !== '/auth'
          ? `/auth?from=${encodeURIComponent(returnPath)}`
          : '/auth';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
