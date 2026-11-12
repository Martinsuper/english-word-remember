import { bookRepository } from '../infrastructure/database/repositories/bookRepository';
import { readingFileStore } from '../infrastructure/files/readingFileStore';

export async function deleteReadingBook(bookId: string): Promise<void> {
  await bookRepository.updateBookStatus(bookId, 'deleting');
  try {
    await readingFileStore.deleteBookFiles(bookId);
    await bookRepository.deleteBook(bookId);
  } catch (error) {
    await bookRepository.updateBookStatus(bookId, 'ready').catch(() => undefined);
    throw error;
  }
}
