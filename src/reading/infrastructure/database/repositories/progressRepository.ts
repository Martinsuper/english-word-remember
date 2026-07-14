import { getDatabase } from '../database';
import type { ReadingProgress, ReadingLocator } from '../../../domain/models';

export const progressRepository = {
  async getProgress(bookId: string): Promise<ReadingProgress | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM reading_progress WHERE book_id = ?',
      [bookId],
    );
    return row ? mapProgressRow(row) : null;
  },

  async saveProgress(progress: ReadingProgress): Promise<void> {
    const db = await getDatabase();
    const locatorJson = JSON.stringify(progress.locator);

    await db.runAsync(
      `INSERT OR REPLACE INTO reading_progress (book_id, locator_json, overall_progress, updated_at)
       VALUES (?, ?, ?, ?)`,
      [progress.bookId, locatorJson, progress.overallProgress, progress.updatedAt],
    );
  },

  async deleteProgress(bookId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM reading_progress WHERE book_id = ?', [bookId]);
  },
};

function mapProgressRow(row: any): ReadingProgress {
  const locator: ReadingLocator = JSON.parse(row.locator_json);
  return {
    bookId: row.book_id,
    locator,
    overallProgress: row.overall_progress,
    updatedAt: row.updated_at,
  };
}
