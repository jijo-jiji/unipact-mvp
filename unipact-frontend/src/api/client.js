import axios from 'axios';

// 1. Define the Base URL (Where Django lives)
// In development, this is usually localhost:8000
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

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
