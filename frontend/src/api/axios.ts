import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { addOfflineRequest } from '../utils/offlineQueue';

/**
 * Dev (Vite :5173) → API en :3000 del mismo host.
 * Producción / nginx (:80) / Tailscale HTTPS (mismo origen) → origin actual.
 * Puerto vacío, 80 o 443 = mismo origen (no añadir :3000).
 */
export const resolveBackendUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  const { protocol, hostname, port } = window.location;
  const isViteDev = port === '5173' || import.meta.env.DEV;
  if (isViteDev) {
    return `${protocol}//${hostname}:3000`;
  }
  // nginx en :80, HTTPS en :443 o URL sin puerto explícito → same-origin
  const isDefaultPort = !port || port === '80' || port === '443';
  return `${protocol}//${hostname}${isDefaultPort ? '' : `:${port}`}`;
};

export const BACKEND_URL = resolveBackendUrl();

/** Timeout por defecto: evita spinners eternos si el servidor cae pero el Wi‑Fi sigue “online”. */
const DEFAULT_TIMEOUT_MS = 15_000;

const api: AxiosInstance = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: DEFAULT_TIMEOUT_MS,
});

/** Cliente sin interceptores offline: para sync de cola y llamadas internas. */
export const bareAxios: AxiosInstance = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
});

const OFFLINE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const isMutatingMethod = (method?: string) =>
  OFFLINE_METHODS.has((method || 'GET').toUpperCase());

const queueIfOffline = async (config: {
  url?: string;
  method?: string;
  headers?: unknown;
  data?: unknown;
  baseURL?: string;
}) => {
  const method = (config.method || 'GET').toUpperCase();
  if (!isMutatingMethod(method)) return false;

  const path = config.url || '';
  if (!path) return false;

  const absolute =
    path.startsWith('http')
      ? path
      : `${config.baseURL || `${BACKEND_URL}/api`}${path.startsWith('/') ? '' : '/'}${path}`;

  // No encolar URLs relativas rotas ni endpoints sin host.
  if (!absolute.startsWith('http')) return false;

  const headers: Record<string, string> = {};
  const raw = config.headers as Record<string, unknown> | undefined;
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string') headers[k] = v;
    }
  }
  const token = localStorage.getItem('token');
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body = config.data;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    // FormData no se serializa bien en IDB.
    return false;
  }
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      /* keep string */
    }
  }

  await addOfflineRequest(absolute, method, headers, body);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fiix-offline-sync-done'));
  }
  return true;
};

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    localStorage.setItem('lastActivity', Date.now().toString());
  }

  // Solo encolar si el navegador reporta offline. GET nunca se encola.
  if (!navigator.onLine && isMutatingMethod(config.method)) {
    const queued = await queueIfOffline({
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data,
      baseURL: config.baseURL,
    });
    if (queued) {
      return Promise.reject({ isOfflineHandled: true, message: 'Guardado offline', config });
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.isOfflineHandled) {
      return {
        data: { success: true, offline: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: error.config,
      };
    }

    if (error.response?.status === 401) {
      // No cerrar sesión / recargar por 401 de login (credenciales incorrectas)
      // ni de /dev/* (contraseña maestra ≠ token de sesión).
      // El backend ya usa 403 para contraseña de desarrollador incorrecta; esto es red de seguridad.
      const reqUrl = String(error.config?.url || '');
      if (reqUrl.includes('/auth/login') || reqUrl.includes('/dev/')) {
        return Promise.reject(error);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('lastActivity');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Solo si seguimos offline y no hubo respuesta HTTP (caída a mitad de la petición).
    // Nunca encolar por 4xx/5xx ni por "Network Error" estando online (evita falsos positivos).
    if (
      !navigator.onLine &&
      !error.response &&
      error.config &&
      isMutatingMethod(error.config.method)
    ) {
      const queued = await queueIfOffline({
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers,
        data: error.config.data,
        baseURL: error.config.baseURL,
      });
      if (queued) {
        return {
          data: { success: true, offline: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: error.config,
        };
      }
    }

    return Promise.reject(error);
  }
);

export default api;
