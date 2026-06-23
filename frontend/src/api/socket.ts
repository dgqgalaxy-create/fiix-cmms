import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from './axios';

// Singleton de conexión a socket.io
// Lo exportamos para usarlo en cualquier componente que lo necesite
export const socket: Socket = io(BACKEND_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

socket.on('connect', () => {
  console.log('[Socket.io] Conectado al servidor en tiempo real');
});

socket.on('disconnect', () => {
  console.log('[Socket.io] Desconectado del servidor');
});
