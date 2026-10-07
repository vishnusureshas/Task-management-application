import request from 'supertest';
import sharp from 'sharp';
import app from '../src/app.js';
import { db } from '../src/config/database.js';
import { resetDb, cleanQueues, closeAll } from './helpers.js';

const USER = { 'x-user-id': '123' };

async function tinyJpeg() {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 120, b: 200 } } })
    .jpeg()
    .toBuffer();
}

beforeEach(async () => {
  await resetDb();
  await cleanQueues();
});

afterAll(async () => {
  await closeAll();
});

describe('GET /api/health', () => {
  it('returns up status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('up');
  });
});

describe('POST /api/tasks', () => {
  it('creates a task as PENDING with 201', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(USER)
      .send({ title: 'Complete assignment', description: 'Finish PERN task', priority: 'HIGH', processingType: 'STANDARD' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toEqual(expect.any(Number));
    expect(res.body.data.title).toBe('Complete assignment');
    expect(res.body.data.status).toBe('PENDING');
  });

  it('rejects a missing title with 400', async () => {
    const res = await request(app).post('/api/tasks').set(USER).send({ priority: 'HIGH' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an invalid priority with 400', async () => {
    const res = await request(app).post('/api/tasks').set(USER).send({ title: 'x', priority: 'URGENT' });
    expect(res.status).toBe(400);
  });

  it('accepts multipart images as PENDING documents', async () => {
    const buf = await tinyJpeg();
    const res = await request(app)
      .post('/api/tasks')
      .set(USER)
      .field('title', 'Image task')
      .attach('images', buf, 'image1.jpg');

    expect(res.status).toBe(201);
    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.data.documents[0].status).toBe('PENDING');
  });

  it('rejects non-image uploads with 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(USER)
      .field('title', 'Bad file')
      .attach('images', Buffer.from('not an image'), 'note.txt');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/tasks', () => {
  it('lists tasks with their documents, scoped to the user', async () => {
    await request(app).post('/api/tasks').set(USER).send({ title: 'Mine' });
    await request(app).post('/api/tasks').set({ 'x-user-id': 'other' }).send({ title: 'Theirs' });

    const res = await request(app).get('/api/tasks').set(USER);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Mine');
    expect(res.body.data[0].documents).toEqual([]);
  });
});

describe('PATCH /api/tasks/:id/status', () => {
  it('changes status and returns the updated task', async () => {
    const created = await request(app).post('/api/tasks').set(USER).send({ title: 'Flip me' });
    const id = created.body.data.id;

    const res = await request(app).patch(`/api/tasks/${id}/status`).set(USER).send({ status: 'COMPLETED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');

    const row = await db('tasks').where({ id }).first();
    expect(row.status).toBe('COMPLETED');
  });

  it('rejects an invalid status with 400', async () => {
    const created = await request(app).post('/api/tasks').set(USER).send({ title: 'Flip me' });
    const res = await request(app).patch(`/api/tasks/${created.body.data.id}/status`).set(USER).send({ status: 'NOPE' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for another user’s task', async () => {
    const created = await request(app).post('/api/tasks').set(USER).send({ title: 'Mine' });
    const res = await request(app)
      .patch(`/api/tasks/${created.body.data.id}/status`)
      .set({ 'x-user-id': 'other' })
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/queues/:name/metrics', () => {
  it('returns waiting/active/completed/failed for every queue', async () => {
    for (const name of ['taskProcessor', 'imageUpload', 'emailDispatch']) {
      const res = await request(app).get(`/api/queues/${name}/metrics`).set(USER);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        queue: name,
        waiting: expect.any(Number),
        active: expect.any(Number),
        completed: expect.any(Number),
        failed: expect.any(Number),
      });
    }
  });

  it('rejects unknown queues with 400', async () => {
    const res = await request(app).get('/api/queues/nope/metrics').set(USER);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
