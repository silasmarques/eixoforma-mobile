import * as SQLite from 'expo-sqlite';

import { createExpoSqliteClient } from './expoSqliteClient';
import { runMigrations } from './migrate';
import { seedDemoData } from '@/mocks/seedDemoData';
import type { SQLiteClient } from './sqliteClient';

const DATABASE_NAME = 'eixoforma.db';

let clientPromise: Promise<SQLiteClient> | null = null;

async function openAndPrepare(): Promise<SQLiteClient> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const client = createExpoSqliteClient(db);
  await client.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(client);
  await seedDemoData(client);
  return client;
}

/** Lazily opens the singleton app database, migrated and seeded. */
export function getDatabase(): Promise<SQLiteClient> {
  if (!clientPromise) {
    clientPromise = openAndPrepare();
  }
  return clientPromise;
}
