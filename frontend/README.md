# Task Manager — Frontend (React + Vite + Tailwind)

Live UI for the PERN task backend: task list/create with image uploads, task detail
with manual status controls, queue-metrics dashboard, and real-time updates over
Socket.IO. See `../PERN_Task_Frontend_Implementation_Plan.md` for the full contract.

## Prerequisites

- Backend API running on `http://localhost:5005` (with Redis + 3 workers for async processing)
- Node 18+

## Setup

```bash
npm install
cp .env.example .env   # never commit .env
npm run dev            # http://127.0.0.1:5175
```

| Variable          | Default                 | Purpose                                    |
| ----------------- | ----------------------- | ------------------------------------------ |
| `VITE_API_URL`    | `http://localhost:5005` | REST + Socket.IO origin (`:5000` in compose) |
| `VITE_USER_ID`    | `123`                   | Fake-auth user sent as `x-user-id` header  |
| `VITE_MAILHOG_URL`| `http://localhost:8025` | Link target for delivered emails           |

## Pages

| Route         | What it shows |
| ------------- | ------------- |
| `/`           | Create form (JSON or multipart with images) + live task list |
| `/tasks/:id`  | Documents grid (spinner → thumbnail), manual status buttons, live email activity feed |
| `/queues`     | `taskProcessor` / `imageUpload` / `emailDispatch` metrics, polled every 3s |

The header dot polls `GET /api/health` every 15s (green `up`, red otherwise).

## Demo flow (plan §15)

1. Open `/` — health dot goes green against the live API.
2. Create a task → it appears instantly as `PENDING`.
3. Watch it flip `PENDING → PROCESSING → COMPLETED` live, no reload (~5–10s worker delay).
4. Create a task **with images** → document spinners swap to thumbnails without reload.
5. Open the task detail → press `COMPLETED` → status email lands in MailHog (`Open MailHog →`)
   and entries appear in the activity feed.
6. Open `/queues` → numbers move while tasks/images/emails process.

Notes:

- Email history is **live-only** (no backend GET endpoint — plan §12, Option A). Keep the
  detail page open while triggering status changes to see feed entries.
- If the socket drops, list/detail pages fall back to polling `GET /api/tasks` every 3s
  and refetch once on reconnect. Kill the API to see the `Offline — polling` badge, then
  restart it to watch recovery.
- A different `VITE_USER_ID` sees an empty list (backend scopes tasks per user).
