import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

// Number('') is 0, so empty env values need explicit guarding.
const parsePositiveInt = (value, fallback) => {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const maxUploadMb = parsePositiveInt(process.env.MAX_UPLOAD_FILE_MB, 5);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 5000),

  // Reserved for Section 2+ (PostgreSQL + Knex). Not required for Section 1.
  databaseUrl: process.env.DATABASE_URL ?? '',

  // Section 5 — Redis + BullMQ (active).
  redisHost: process.env.REDIS_HOST ?? 'localhost',
  redisPort: toNumber(process.env.REDIS_PORT, 6379),

  // Section 7 — Email (active, MailHog).
  smtpHost: process.env.SMTP_HOST ?? 'localhost',
  smtpPort: toNumber(process.env.SMTP_PORT, 1025),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPassword: process.env.SMTP_PASSWORD ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Task Manager <no-reply@taskmanager.local>',
  emailWorkerConcurrency: toNumber(process.env.EMAIL_WORKER_CONCURRENCY, 5),
  // MailHog HTTP UI/API (used by tests and documented for local dev).
  mailhogUiPort: parsePositiveInt(process.env.MAILHOG_UI_PORT, 8025),

  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',

  // Section 9 — Socket.IO (active).
  socketCorsOrigin: process.env.SOCKET_CORS_ORIGIN ?? '*',

  // Section 8 — Image uploads (active).
  maxUploadFiles: parsePositiveInt(process.env.MAX_UPLOAD_FILES, 5),
  maxUploadMb,
  maxUploadBytes: maxUploadMb * 1024 * 1024,
  imageWorkerConcurrency: parsePositiveInt(process.env.IMAGE_WORKER_CONCURRENCY, 3),

  // Section 6 — Task Processor worker (active).
  taskWorkerConcurrency: toNumber(process.env.TASK_WORKER_CONCURRENCY, 5),
  // Optional test override (ms). Empty/unset = random 5–10s fake delay.
  taskWorkerDelayMs: (() => {
    const raw = process.env.TASK_WORKER_DELAY_MS;
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
  })(),
};

export default env;
