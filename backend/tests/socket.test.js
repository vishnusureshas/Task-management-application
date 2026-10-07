import http from 'node:http';
import { io } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { initSocket, closeSocket } from '../src/sockets/socket.js';
import { publishTaskEvent, closeEventBus } from '../src/sockets/eventBus.js';
import { closeQueues } from '../src/queues/index.js';
import { closeRedis } from '../src/config/redis.js';
import { db } from '../src/config/database.js';

let server;
let port;
let client;

beforeAll(async () => {
  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  await initSocket(server);

  client = io(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket connect timeout')), 10000);
    client.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });
  });
});

afterAll(async () => {
  client?.disconnect();
  await closeSocket();
  await closeEventBus();
  await closeQueues();
  await closeRedis();
  await db.destroy();
  await new Promise((resolve) => server.close(resolve));
});

describe('Socket.IO rooms (Section 9)', () => {
  it('delivers task events only to room members', async () => {
    const received = [];
    const otherReceived = [];
    client.on('task:completed', (data) => received.push(data));

    const other = io(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    other.on('task:completed', (data) => otherReceived.push(data));
    try {
      const join = (socket, taskId) =>
        new Promise((resolve, reject) =>
          socket.emit('task:join', { taskId }, (ack) => (ack?.ok ? resolve(ack) : reject(new Error('join failed')))),
        );
      await join(client, 7);
      await join(other, 8);

      await publishTaskEvent({ room: 'task:7', event: 'task:completed', data: { taskId: 7, status: 'COMPLETED' } });
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ taskId: 7, status: 'COMPLETED' });
      expect(otherReceived).toHaveLength(0);
    } finally {
      other.disconnect();
    }
  });

  it('rejects joins without a taskId', async () => {
    const ack = await new Promise((resolve) => client.emit('task:join', {}, resolve));
    expect(ack.ok).toBe(false);
  });
});
