// Runs in every test worker BEFORE test files (and their src imports)
// are loaded, so all config below wins over .env (dotenv never overrides).
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/task_manager_test';
// Short fake delay so worker tests run in milliseconds, not seconds.
process.env.TASK_WORKER_DELAY_MS ??= '50';
process.env.NODE_ENV ??= 'test';
