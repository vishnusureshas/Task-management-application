import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5005';

let socket = null;

// Singleton: one connection per page, shared by list + detail views.
export function getSocket() {
  if (!socket) {
    socket = io(URL, { transports: ['websocket'] });
  }
  return socket;
}

export function joinTaskRoom(taskId) {
  return new Promise((resolve, reject) => {
    getSocket().emit('task:join', { taskId }, (ack) =>
      ack?.ok ? resolve(ack) : reject(new Error(ack?.message || 'Join failed')),
    );
  });
}

export function leaveTaskRoom(taskId) {
  getSocket().emit('task:leave', { taskId }, () => {});
}
