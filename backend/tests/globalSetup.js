// Jest globalSetup (separate process): ensure the isolated test database
// exists and migrated, so `npm test` works on a fresh machine with zero
// manual steps beyond a running PostgreSQL + Redis.
export default async function globalSetup() {
  const testUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/task_manager_test';
  process.env.DATABASE_URL = testUrl;

  const url = new URL(testUrl);
  const dbName = url.pathname.replace(/^\//, '');
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';

  const { Client } = await import('pg');
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length === 0) {
      const safeName = dbName.replace(/"/g, '""');
      await admin.query(`CREATE DATABASE "${safeName}"`);
    }
  } finally {
    await admin.end();
  }

  const { default: knex } = await import('knex');
  const { default: knexConfig } = await import('../knexfile.js');
  const migrator = knex(knexConfig.test ?? knexConfig.development);
  try {
    await migrator.migrate.latest();
  } finally {
    await migrator.destroy();
  }
}
