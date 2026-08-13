import { Server, Socket } from 'socket.io';
import http from 'http';
import { verifyToken } from './auth';
import prisma from '../config/prisma';
import { ackChatMessageDelivered } from '../services/chatReceipts';
import { isAllowedOrigin } from './corsOrigins';

let io: Server;

type PresenceUser = {
  socketId: string;
  userId: string;
  name: string;
  lastSeen: number;
  joinedAt: number;
};

/** workOrderId → socketId → presence */
const woPresence = new Map<string, Map<string, PresenceUser>>();

const HEARTBEAT_TIMEOUT_MS = 40_000;
const SWEEP_INTERVAL_MS = 10_000;

type SocketUser = { userId: string; name: string; role: string };

function getSocketUser(socket: Socket): SocketUser | null {
  return (socket.data as { user?: SocketUser }).user || null;
}

function roomName(workOrderId: string) {
  return `wo:${workOrderId}`;
}

function presenceSnapshot(workOrderId: string) {
  const members = woPresence.get(workOrderId);
  if (!members || members.size === 0) {
    return { editor: null as null | { userId: string; name: string }, viewers: [] as { userId: string; name: string }[] };
  }

  const list = Array.from(members.values()).sort((a, b) => a.joinedAt - b.joinedAt);
  // First unique user by join time is the editor
  const editorEntry = list[0];
  const editor = editorEntry ? { userId: editorEntry.userId, name: editorEntry.name } : null;
  const seen = new Set<string>();
  const viewers: { userId: string; name: string }[] = [];
  for (const m of list) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    if (editor && m.userId === editor.userId) continue;
    viewers.push({ userId: m.userId, name: m.name });
  }
  return { editor, viewers };
}

function broadcastPresence(workOrderId: string) {
  if (!io) return;
  io.to(roomName(workOrderId)).emit('wo:presence', {
    workOrderId,
    ...presenceSnapshot(workOrderId),
  });
}

function removeSocketFromAllRooms(socketId: string) {
  const affected: string[] = [];
  for (const [workOrderId, members] of woPresence.entries()) {
    if (members.delete(socketId)) {
      affected.push(workOrderId);
      if (members.size === 0) woPresence.delete(workOrderId);
    }
  }
  for (const workOrderId of affected) {
    broadcastPresence(workOrderId);
  }
}

function joinWorkOrder(socket: Socket, workOrderId: string) {
  const user = getSocketUser(socket);
  if (!user || !workOrderId) return;

  socket.join(roomName(workOrderId));
  let members = woPresence.get(workOrderId);
  if (!members) {
    members = new Map();
    woPresence.set(workOrderId, members);
  }

  const now = Date.now();
  const existing = members.get(socket.id);
  members.set(socket.id, {
    socketId: socket.id,
    userId: user.userId,
    name: user.name,
    lastSeen: now,
    joinedAt: existing?.joinedAt ?? now,
  });

  broadcastPresence(workOrderId);
}

function leaveWorkOrder(socket: Socket, workOrderId: string) {
  if (!workOrderId) return;
  socket.leave(roomName(workOrderId));
  const members = woPresence.get(workOrderId);
  if (!members) return;
  if (members.delete(socket.id)) {
    if (members.size === 0) woPresence.delete(workOrderId);
    broadcastPresence(workOrderId);
  }
}

function heartbeatWorkOrder(socket: Socket, workOrderId: string) {
  const members = woPresence.get(workOrderId);
  const entry = members?.get(socket.id);
  if (entry) {
    entry.lastSeen = Date.now();
  } else {
    // Rejoin if heartbeat arrives without prior join (reconnect)
    joinWorkOrder(socket, workOrderId);
  }
}

function sweepStalePresence() {
  const now = Date.now();
  const affected: string[] = [];
  for (const [workOrderId, members] of woPresence.entries()) {
    for (const [socketId, entry] of members.entries()) {
      if (now - entry.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        members.delete(socketId);
        affected.push(workOrderId);
      }
    }
    if (members.size === 0) woPresence.delete(workOrderId);
  }
  for (const workOrderId of new Set(affected)) {
    broadcastPresence(workOrderId);
  }
}

export const initSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin || undefined)) {
          callback(null, true);
          return;
        }
        callback(new Error('Socket CORS: origen no permitido'));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth as { token?: string })?.token ||
        (typeof socket.handshake.headers.authorization === 'string'
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : undefined);

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = verifyToken(token) as { userId: string; role: string };
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, role: true, is_active: true },
      });

      if (!dbUser || !dbUser.is_active) {
        return next(new Error('Unauthorized'));
      }

      (socket.data as { user: SocketUser }).user = {
        userId: dbUser.id,
        name: dbUser.name,
        role: dbUser.role,
      };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = getSocketUser(socket);
    console.log(`[Socket.io] Conectado: ${socket.id} (${user?.name || 'sin nombre'})`);

    if (user?.userId) {
      socket.join(`user:${user.userId}`);
      // Presencia: marcar activo al conectar (no depender solo del heartbeat HTTP)
      void prisma.user
        .update({
          where: { id: user.userId },
          data: { last_active: new Date() },
        })
        .catch((err: unknown) => console.error('[Socket.io] last_active on connect', err));
    }

    socket.on('wo:join', (payload: { workOrderId?: string }) => {
      if (payload?.workOrderId) joinWorkOrder(socket, payload.workOrderId);
    });

    socket.on('wo:leave', (payload: { workOrderId?: string }) => {
      if (payload?.workOrderId) leaveWorkOrder(socket, payload.workOrderId);
    });

    socket.on('wo:heartbeat', (payload: { workOrderId?: string }) => {
      if (payload?.workOrderId) heartbeatWorkOrder(socket, payload.workOrderId);
    });

    socket.on(
      'chat_delivered',
      (payload: { conversation_id?: string; message_id?: string }) => {
        const u = getSocketUser(socket);
        if (!u?.userId || !payload?.conversation_id || !payload?.message_id) return;
        void ackChatMessageDelivered(u.userId, payload.conversation_id, payload.message_id).catch(
          (err) => console.error('[Socket.io] chat_delivered', err)
        );
      }
    );

    socket.on('disconnect', () => {
      removeSocketFromAllRooms(socket.id);
      console.log(`[Socket.io] Desconectado: ${socket.id}`);
    });
  });

  setInterval(sweepStalePresence, SWEEP_INTERVAL_MS);

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io no ha sido inicializado!');
  }
  return io;
};

/** Emite un evento de refresco a todos los clientes (ignora si socket no está listo). */
export const emitRefresh = (event: string, payload?: unknown) => {
  try {
    if (!io) return;
    if (payload !== undefined) {
      io.emit(event, payload);
    } else {
      io.emit(event);
    }
  } catch (err) {
    console.error(`[Socket.io] Error emitiendo ${event}:`, err);
  }
};

export const emitWorkOrderUpdated = (id: string) => {
  emitRefresh('refresh_work_orders');
  emitRefresh('work_order_updated', { id });
};

/** Emite a la sala de una OT (comentarios, etc.). */
export const emitToWorkOrderRoom = (workOrderId: string, event: string, payload?: unknown) => {
  try {
    if (!io) return;
    if (payload !== undefined) {
      io.to(`wo:${workOrderId}`).emit(event, payload);
    } else {
      io.to(`wo:${workOrderId}`).emit(event);
    }
  } catch (err) {
    console.error(`[Socket.io] Error emitiendo ${event} a wo:${workOrderId}:`, err);
  }
};

/** Emite a un usuario concreto (sala user:{id}). */
export const emitToUser = (userId: string, event: string, payload?: unknown) => {
  try {
    if (!io) return;
    if (payload !== undefined) {
      io.to(`user:${userId}`).emit(event, payload);
    } else {
      io.to(`user:${userId}`).emit(event);
    }
  } catch (err) {
    console.error(`[Socket.io] Error emitiendo ${event} a user:${userId}:`, err);
  }
};

/** IDs de usuarios con al menos un socket conectado ahora. */
export function getConnectedUserIds(): string[] {
  if (!io) return [];
  const ids = new Set<string>();
  for (const sock of io.sockets.sockets.values()) {
    const u = getSocketUser(sock);
    if (u?.userId) ids.add(u.userId);
  }
  return Array.from(ids);
}
