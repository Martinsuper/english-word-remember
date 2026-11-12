import type { SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await migration1(db);
  }
  if (currentVersion < 2) {
    await migration2(db);
  }
  if (currentVersion < 3) {
    await migration3(db);
  }
}

async function migration2(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<{ id: string; word_id: string; normalized_term: string }>(
      'SELECT id, word_id, normalized_term FROM word_contexts WHERE word_id = id',
    );
    for (const row of rows) {
      const slug = row.normalized_term.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      await db.runAsync('UPDATE word_contexts SET word_id = ? WHERE id = ?', [`reading-${slug}`, row.id]);
    }
    await db.execAsync('PRAGMA user_version = 2;');
  });
}

async function migration3(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<{ id: string; word_id: string }>(
      "SELECT id, word_id FROM word_contexts WHERE id LIKE 'reading-%' AND word_id LIKE 'ctx_%'",
    );
    for (const row of rows) {
      await db.runAsync(
        'UPDATE word_contexts SET id = ?, word_id = ? WHERE id = ?',
        [row.word_id, row.id, row.id],
      );
    }
    await db.execAsync('PRAGMA user_version = 3;');
  });
}

async function migration1(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reading_books (
      id TEXT PRIMARY KEY NOT NULL,
      content_hash TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      author TEXT,
      publisher TEXT,
      language TEXT,
      description TEXT,
      cover_path TEXT,
      source_type TEXT NOT NULL,
      source_ref TEXT,
      original_file_name TEXT,
      epub_version TEXT,
      status TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      imported_at TEXT NOT NULL,
      last_opened_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reading_chapters (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL REFERENCES reading_books(id) ON DELETE CASCADE,
      spine_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      href TEXT NOT NULL,
      media_type TEXT NOT NULL,
      extracted_path TEXT NOT NULL,
      linear INTEGER NOT NULL DEFAULT 1,
      UNIQUE(book_id, spine_index)
    );

    CREATE INDEX IF NOT EXISTS idx_reading_chapters_book_spine
      ON reading_chapters(book_id, spine_index);

    CREATE TABLE IF NOT EXISTS reading_progress (
      book_id TEXT PRIMARY KEY NOT NULL REFERENCES reading_books(id) ON DELETE CASCADE,
      locator_json TEXT NOT NULL,
      overall_progress REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS word_contexts (
      id TEXT PRIMARY KEY NOT NULL,
      word_id TEXT NOT NULL,
      normalized_term TEXT NOT NULL,
      surface_form TEXT NOT NULL,
      book_id TEXT REFERENCES reading_books(id) ON DELETE SET NULL,
      chapter_id TEXT,
      locator_json TEXT NOT NULL,
      sentence TEXT NOT NULL,
      created_at TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      source_fingerprint TEXT NOT NULL UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_word_contexts_word
      ON word_contexts(word_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_word_contexts_book
      ON word_contexts(book_id);

    CREATE TABLE IF NOT EXISTS lookup_history (
      id TEXT PRIMARY KEY NOT NULL,
      normalized_term TEXT NOT NULL,
      surface_form TEXT NOT NULL,
      book_id TEXT NOT NULL REFERENCES reading_books(id) ON DELETE CASCADE,
      chapter_id TEXT NOT NULL,
      locator_json TEXT NOT NULL,
      looked_up_at TEXT NOT NULL,
      added_to_vocabulary INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_lookup_history_book_time
      ON lookup_history(book_id, looked_up_at DESC);

    CREATE TABLE IF NOT EXISTS reading_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      font_size REAL NOT NULL DEFAULT 18,
      line_height REAL NOT NULL DEFAULT 1.65,
      margin_size INTEGER NOT NULL DEFAULT 20,
      theme TEXT NOT NULL DEFAULT 'system',
      font_family TEXT NOT NULL DEFAULT 'serif',
      tap_lookup_enabled INTEGER NOT NULL DEFAULT 1
    );

    INSERT OR IGNORE INTO reading_settings (id) VALUES (1);

    PRAGMA user_version = 1;
  `);
}
