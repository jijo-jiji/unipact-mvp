import axios from 'axios';

// 1. Define the Base URL (Where Django lives)
// In development, this is usually localhost:8000
const getBaseUrl = () => {
  const hostname = window.location.hostname;

  // PRIORITY 1: Match the browser's hostname to avoid Cross-Site Cookie blocking
  if (hostname === 'localhost') {
    return 'http://localhost:8000/api';
  }

  // PRIORITY 2: Check Env Var
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Fallback
  return 'http://127.0.0.1:8000/api';
};

const BASE_URL = getBaseUrl();

// 2. Create the Axios Instance (The Communicator)
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // IMPORTANT: Cookies
});

// 3. Response Interceptor (Optional: Handle 401s globally)
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    // Optional: Redirect to login or clear state
    // window.location.href = '/login';
  }
  return Promise.reject(error);
});

export default api;
