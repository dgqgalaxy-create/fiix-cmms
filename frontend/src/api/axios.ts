import axios from 'axios';

export const BACKEND_URL = `http://${window.location.hostname}:3000`;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
});

// Interceptor para inyectar el token en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
