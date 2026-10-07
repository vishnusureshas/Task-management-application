# PERN Task Management Application

A task manager built on the **PERN stack** where all slow or failure-prone work is
**asynchronous**: creating a task returns `201` immediately while BullMQ workers
process tasks, optimize images, and send emails in the background. The React
frontend tracks everything live over Socket.IO — no page reloads.

Detailed contracts live in
[`PERN_Task_Backend_Implementation_Plan.md`](./PERN_Task_Backend_Implementation_Plan.md)
and
[`PERN_Task_Frontend_Implementation_Plan.md`](./PERN_Task_Frontend_Implementation_Plan.md).

## Architecture

```text
                          USER
                            │
                            ▼
                     React Frontend (Vite, :5175)
                            │
                     REST + Socket.IO
                            │
                            ▼
                     Express API (:5000)
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
         PostgreSQL       Redis        Socket.IO
              │             │
              │        ┌────┼────┐
              │        │    │    │
              │        ▼    ▼    ▼
              │      Task  Image Email
              │      Queue Queue Queue
              │        │    │    │
              │        ▼    ▼    ▼
              │      Worker Worker Worker ──→ MailHog (:8025)
              │        │    │    │
              └────────┴────┴────┘
                       │
                       ▼
                   PostgreSQL → Socket.IO → React updates
```

## Technology stack

React · Node.js 18+ · Express 5 · PostgreSQL 14 · Knex · Redis 7 · BullMQ ·
Socket.IO 4 · Nodemailer · MailHog · Sharp · Multer · Jest + Supertest · Docker Compose

## Setup

### Option A — Docker Compose (recommended for evaluation)

```bash
docker compose up --build
```

This starts `api` (`:5000`), 3 workers, `postgres`, `redis`, and `mailhog`
(`:8025`). Migrations run automatically on API boot. Then, in a second terminal:

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:5000 npm run dev   # http://127.0.0.1:5175
```

> If ports `5000`/`5432`/`6379`/`8025`/`1025` are already taken by other local
> containers, stop them first (`docker stop …`) or adjust the port mappings in
> `docker-compose.yml`.

### Option B — Local development

| Service | URL |
| ------- | --- |
| API | `http://localhost:5005` (`PORT` in `backend/.env`) |
| Frontend | `http://127.0.0.1:5175` |
| MailHog UI | `http://localhost:8025` |

```bash
# backend (needs local PostgreSQL + Redis + MailHog — see backend/.env)
cd backend && npm install
npx knex migrate:latest
node src/server.js                 # API
node src/workers/taskProcessor.worker.js
node src/workers/imageUpload.worker.js
node src/workers/emailDispatch.worker.js

# frontend
cd frontend && npm install && npm run dev
```

## Environment variables

Both packages ship `.env.example` (canonical values); never commit `.env`.

Backend (`backend/.env`): `PORT`, `DATABASE_URL`, `REDIS_HOST`/`REDIS_PORT`,
`SMTP_HOST`/`SMTP_PORT`, `UPLOAD_DIR`, worker concurrencies — see
`backend/.env.example`.

Frontend (`frontend/.env`): `VITE_API_URL` (`:5005` local, `:5000` under
compose), `VITE_USER_ID` (`123`, sent as `x-user-id` on every API call),
`VITE_MAILHOG_URL`.

## API documentation

All responses use the envelope `{ "success": true, "data": … }`; errors are
`{ "success": false, "message": … }`. Every `/api/tasks` and `/api/queues/*`
request must carry the `x-user-id` header (fake auth — no login).

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| `GET` | `/api/health` | Liveness probe (no header needed) |
| `POST` | `/api/tasks` | Create task — JSON **or** `multipart/form-data` with `images` |
| `GET` | `/api/tasks` | List my tasks with documents |
| `PATCH` | `/api/tasks/:id/status` | Manual status change (also triggers a status email) |
| `GET` | `/api/queues/:name/metrics` | `taskProcessor` / `imageUpload` / `emailDispatch` metrics |

Socket.IO (same origin as the API, rooms `task:{id}`): `task:processing` ·
`task:completed` · `task:failed` · `document:processing` · `document:completed` ·
`document:failed` · `email:attempt` · `email:sent` · `email:failed`.

## Curl examples

```bash
BASE=http://localhost:5000   # :5005 for local dev
UID=123

# Health
curl $BASE/api/health

# Create task (JSON) → 201, status PENDING
curl -X POST $BASE/api/tasks -H "Content-Type: application/json" -H "x-user-id: $UID" \
  -d '{"title":"Complete assignment","description":"Finish PERN task","priority":"HIGH","processingType":"STANDARD"}'

# Create task with images (jpeg/png/webp/gif, ≤5MB each, ≤5 files)
curl -X POST $BASE/api/tasks -H "x-user-id: $UID" \
  -F title="With images" -F priority=MEDIUM -F images=@photo.jpg

# List tasks (scoped to x-user-id)
curl $BASE/api/tasks -H "x-user-id: $UID"

# Manual status change (triggers a status-change email)
curl -X PATCH $BASE/api/tasks/1/status -H "Content-Type: application/json" -H "x-user-id: $UID" \
  -d '{"status":"COMPLETED"}'

# Queue metrics
curl $BASE/api/queues/taskProcessor/metrics -H "x-user-id: $UID"
curl $BASE/api/queues/imageUpload/metrics -H "x-user-id: $UID"
curl $BASE/api/queues/emailDispatch/metrics -H "x-user-id: $UID"
```

## Queue architecture

```text
taskProcessor  — slow task work (fake 5–10s): PENDING → PROCESSING → COMPLETED/FAILED
imageUpload    — Sharp 256px thumbnails + original storage, per document
emailDispatch  — Nodemailer → MailHog, 3 attempts with exponential backoff
```

Workers log `completed` / `failed` / `stalled` events; the email worker records
attempts, status, errors, and sent time in `email_jobs`.

## Testing

```bash
cd backend && npm test   # Jest + Supertest: 4 suites, 20 tests (API + workers + socket)
cd frontend && npm run lint && npm run build
```

## MailHog

Open `http://localhost:8025` to see delivered emails. Trigger one from the UI
(task detail → status button) or via `PATCH /api/tasks/:id/status`. The task
detail page also shows a live email activity feed while status changes happen.

## Demo

Suggested flow: create a task → watch `PENDING → PROCESSING → COMPLETED` live →
create one with images → watch thumbnails appear → flip a status on the detail
page → see the email in MailHog and the queue numbers move on `/queues`.

> Demo video (≤ 5 min): _TODO — add link._
