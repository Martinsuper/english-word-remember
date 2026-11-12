import { getDatabase } from '../database';
import type { ReadingBook, ReadingChapter } from '../../../domain/models';

export const bookRepository = {
  async listBooks(): Promise<ReadingBook[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM reading_books WHERE status != ? ORDER BY last_opened_at DESC, imported_at DESC',
      ['deleting'],
    );
    return rows.map(mapBookRow);
  },

  async getBook(id: string): Promise<ReadingBook | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM reading_books WHERE id = ?', [id]);
    return row ? mapBookRow(row) : null;
  },

  async findByContentHash(hash: string): Promise<ReadingBook | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM reading_books WHERE content_hash = ? AND status != ?',
      [hash, 'deleting'],
    );
    return row ? mapBookRow(row) : null;
  },

  async createBook(book: ReadingBook): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO reading_books (
        id, content_hash, title, author, publisher, language, description,
        cover_path, source_type, source_ref, original_file_name, epub_version,
        status, file_size, error_code, imported_at, last_opened_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.id,
        book.contentHash,
        book.title,
        book.author ?? null,
        book.publisher ?? null,
        book.language ?? null,
        book.description ?? null,
        book.coverPath ?? null,
        book.sourceType,
        book.sourceRef ?? null,
        book.originalFileName ?? null,
        book.epubVersion ?? null,
        book.status,
        book.fileSize,
        null,
        book.importedAt,
        null,
      ],
    );
  },

  async updateBookStatus(id: string, status: ReadingBook['status'], errorCode?: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE reading_books SET status = ?, error_code = ? WHERE id = ?',
      [status, errorCode ?? null, id],
    );
  },

  async updateLastOpened(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE reading_books SET last_opened_at = ? WHERE id = ?',
      [new Date().toISOString(), id],
    );
  },

  async listChapters(bookId: string): Promise<ReadingChapter[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM reading_chapters WHERE book_id = ? ORDER BY spine_index',
      [bookId],
    );
    return rows.map(mapChapterRow);
  },

  async createChapters(chapters: ReadingChapter[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const chapter of chapters) {
        await db.runAsync(
          `INSERT INTO reading_chapters (
            id, book_id, spine_index, title, href, media_type, extracted_path, linear
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            chapter.id,
            chapter.bookId,
            chapter.spineIndex,
            chapter.title,
            chapter.href,
            chapter.mediaType,
            chapter.extractedPath,
            chapter.linear ? 1 : 0,
          ],
        );
      }
    });
  },

  async createBookWithChapters(book: ReadingBook, chapters: ReadingChapter[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await this.createBook(book);
      for (const chapter of chapters) {
        await db.runAsync(
          `INSERT INTO reading_chapters (
            id, book_id, spine_index, title, href, media_type, extracted_path, linear
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [chapter.id, chapter.bookId, chapter.spineIndex, chapter.title, chapter.href,
            chapter.mediaType, chapter.extractedPath, chapter.linear ? 1 : 0],
        );
      }
    });
  },

  async deleteBook(id: string): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM reading_progress WHERE book_id = ?', [id]);
      await db.runAsync('DELETE FROM reading_chapters WHERE book_id = ?', [id]);
      await db.runAsync('DELETE FROM reading_books WHERE id = ?', [id]);
    });
  },
};

function mapBookRow(row: any): ReadingBook {
  return {
    id: row.id,
    contentHash: row.content_hash,
    title: row.title,
    author: row.author ?? undefined,
    publisher: row.publisher ?? undefined,
    language: row.language ?? undefined,
    description: row.description ?? undefined,
    coverPath: row.cover_path ?? undefined,
    sourceType: row.source_type,
    sourceRef: row.source_ref ?? undefined,
    originalFileName: row.original_file_name ?? undefined,
    epubVersion: row.epub_version ?? undefined,
    status: row.status,
    fileSize: row.file_size,
    importedAt: row.imported_at,
    lastOpenedAt: row.last_opened_at ?? undefined,
  };
}

function mapChapterRow(row: any): ReadingChapter {
  return {
    id: row.id,
    bookId: row.book_id,
    spineIndex: row.spine_index,
    title: row.title,
    href: row.href,
    mediaType: row.media_type,
    extractedPath: row.extracted_path,
    linear: row.linear === 1,
  };
}
