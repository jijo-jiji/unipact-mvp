import axios from 'axios';

// 1. Define the Base URL (Where Django lives)
const getBaseUrl = () => {
  // Production builds: set VITE_API_BASE_URL, e.g. https://api.unipact.my/api
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }

  // Development: talk to the local Django server on the same hostname the page was opened with,
  // so cookies are not treated as cross-site (localhost and 127.0.0.1 count as different sites)
  const hostname = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
  if (import.meta.env.PROD) {
    console.error('VITE_API_BASE_URL is not set; API calls will go to a local server and fail.');
  }
  return `http://${hostname}:8000/api`;
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

// 3. Response Interceptor: access tokens expire after 60 minutes, so on a 401
// quietly swap the refresh cookie for a new access token and retry once.
const AUTH_PATHS = ['/users/login/', '/users/token/refresh/', '/users/logout/'];
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = AUTH_PATHS.some((path) => original?.url?.includes(path));

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        refreshPromise = refreshPromise || api.post('/users/token/refresh/');
        await refreshPromise;
        return api(original);
      } catch {
        // Refresh failed: the session is really over, surface the original 401
      } finally {
        refreshPromise = null;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
