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
    localStorage.setItem('lastActivity', Date.now().toString());
  }
  return config;
});

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('lastActivity');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
