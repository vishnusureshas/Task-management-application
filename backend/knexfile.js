import dotenv from 'dotenv';

dotenv.config();

const connection =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/task_manager';

const base = {
  client: 'pg',
  connection,
  pool: { min: 2, max: 10 },
  migrations: {
    directory: './src/db/migrations',
    extension: 'js',
  },
  seeds: {
    directory: './src/db/seeds',
    extension: 'js',
  },
};

export default {
  development: { ...base },
  test: { ...base },
  production: { ...base },
};
