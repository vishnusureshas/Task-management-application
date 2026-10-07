import knex from 'knex';
import knexConfig from '../../knexfile.js';
import { env } from './env.js';

const environment = knexConfig[env.nodeEnv] ? env.nodeEnv : 'development';

export const db = knex(knexConfig[environment]);

export async function checkDatabaseConnection() {
  await db.raw('SELECT 1');
  return true;
}

export default db;
