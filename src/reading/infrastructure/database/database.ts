import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const database = await SQLite.openDatabaseAsync('reading.db');
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(database);
    db = database;
    return database;
  })();

  return initPromise;
}

export async function resetDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    initPromise = null;
  }
}

/**
 * 清空全部阅读学习数据（书、章节、进度、生词语境、查词历史），保留阅读器设置。
 */
export async function clearReadingData(): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.execAsync('DELETE FROM word_contexts;');
    await database.execAsync('DELETE FROM lookup_history;');
    // books 行删除会级联清空 chapters 与 progress（均带 ON DELETE CASCADE）。
    await database.execAsync('DELETE FROM reading_books;');
  });
}
