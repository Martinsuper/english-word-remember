import { getDatabase } from '../database';
import type { WordContext, ReadingLocator } from '../../../domain/models';

export const wordContextRepository = {
  async createContext(context: WordContext): Promise<void> {
    const db = await getDatabase();
    const fingerprint = computeFingerprint(context);

    try {
      await db.runAsync(
        `INSERT INTO word_contexts (
          id, word_id, normalized_term, surface_form, book_id, chapter_id,
          locator_json, sentence, created_at, is_primary, source_fingerprint
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          context.id,
          context.wordId,
          context.normalizedTerm,
          context.surfaceForm,
          context.bookId || null,
          context.chapterId || null,
          JSON.stringify(context.locator),
          context.sentence,
          context.createdAt,
          context.isPrimary ? 1 : 0,
          fingerprint,
        ],
      );
    } catch (error: any) {
      if (error?.message?.includes('UNIQUE constraint failed')) {
        return;
      }
      throw error;
    }
  },

  async findByWordId(wordId: string): Promise<WordContext[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM word_contexts WHERE word_id = ? ORDER BY created_at DESC',
      [wordId],
    );
    return rows.map(mapRow);
  },

  async findByBookId(bookId: string): Promise<WordContext[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM word_contexts WHERE book_id = ? ORDER BY created_at DESC',
      [bookId],
    );
    return rows.map(mapRow);
  },

  async deleteByBookId(bookId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE word_contexts SET book_id = NULL WHERE book_id = ?',
      [bookId],
    );
  },
};

function computeFingerprint(ctx: WordContext): string {
  const sentence = ctx.sentence.trim().replace(/\s+/g, ' ');
  return `${ctx.normalizedTerm}|${ctx.bookId}|${ctx.chapterId}|${sentence}`;
}

function mapRow(row: any): WordContext {
  return {
    id: row.id,
    wordId: row.word_id,
    normalizedTerm: row.normalized_term,
    surfaceForm: row.surface_form,
    bookId: row.book_id || '',
    chapterId: row.chapter_id || '',
    locator: JSON.parse(row.locator_json),
    sentence: row.sentence,
    createdAt: row.created_at,
    isPrimary: row.is_primary === 1,
  };
}
