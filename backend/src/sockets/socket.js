import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { subscribeTaskEvents, roomForTask } from './eventBus.js';

let io = null;

export function getIO() {
  return io;
}

// Client protocol (used by the React frontend later):
//   socket.emit('task:join', { taskId }, (ack) => ...)  → joins `task:{id}`
//   socket.emit('task:leave', { taskId }, (ack) => ...) → leaves `task:{id}`
export async function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.socketCorsOrigin },
  });

  io.on('connection', (socket) => {
    logger.info(`socket connected (${socket.id})`);

    socket.on('task:join', (payload, ack) => {
      const taskId = payload?.taskId;
      if (taskId === undefined || taskId === null || taskId === '') {
        ack?.({ ok: false, message: 'taskId is required' });
        return;
      }
      const room = roomForTask(taskId);
      socket.join(room);
      logger.info(`socket ${socket.id} joined ${room}`);
      ack?.({ ok: true, room });
    });

    socket.on('task:leave', (payload, ack) => {
      const taskId = payload?.taskId;
      if (taskId === undefined || taskId === null || taskId === '') {
        ack?.({ ok: false, message: 'taskId is required' });
        return;
      }
      const room = roomForTask(taskId);
      socket.leave(room);
      ack?.({ ok: true, room });
    });

    socket.on('disconnect', (reason) => {
      logger.info(`socket disconnected (${socket.id})`, { reason });
    });
  });

  // Worker → PostgreSQL → Redis → here → room members (Section 21 flow).
  await subscribeTaskEvents(({ room, event, data }) => {
    if (!room || !event || !io) return;
    io.to(room).emit(event, data);
    logger.debug(`socket emit ${event} → ${room}`);
  });

  logger.info('Socket.IO ready');
  return io;
}

export async function closeSocket() {
  if (!io) return;
  const server = io;
  io = null;
  await server.close();
  logger.info('Socket.IO closed');
}
