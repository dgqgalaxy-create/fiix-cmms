import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from './axios';

let socketInstance: Socket | null = null;

function createSocket(token?: string | null): Socket {
  return io(BACKEND_URL, {
    autoConnect: !!token,
    reconnection: true,
    // Móvil: el SO corta el WebSocket al suspender; no agotar intentos
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: token ? { token } : {},
  });
}

/** Singleton; call setSocketAuth after login/logout. */
export const socket: Socket = (() => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  socketInstance = createSocket(token);
  return socketInstance;
})();

export function setSocketAuth(token: string | null) {
  if (!socketInstance) return;
  socketInstance.auth = token ? { token } : {};
  if (token) {
    if (socketInstance.connected) {
      socketInstance.disconnect();
    }
    socketInstance.connect();
  } else {
    socketInstance.disconnect();
  }
}

/** Reconectar si hay sesión y el socket está caído (vuelta a la app / red). */
export function ensureSocketConnected() {
  if (!socketInstance) return;
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return;
  socketInstance.auth = { token };
  if (!socketInstance.connected) {
    socketInstance.connect();
  }
}

if (typeof window !== 'undefined') {
  const wake = () => {
    if (document.visibilityState === 'visible') ensureSocketConnected();
  };
  window.addEventListener('online', () => ensureSocketConnected());
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('pageshow', () => ensureSocketConnected());
}

socket.on('connect_error', (err) => {
  if (err.message === 'Unauthorized' || /unauthorized/i.test(err.message)) {
    // Token missing/invalid — stay disconnected until login
  }
});
