import {
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
  readAsStringAsync,
  readDirectoryAsync,
} from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

if (!documentDirectory) {
  throw new Error('documentDirectory is not available');
}

const READING_DIR = `${documentDirectory}reading/`;
const BOOKS_DIR = `${READING_DIR}books/`;
const TEMP_DIR = `${READING_DIR}temp/`;

export const readingFileStore = {
  async initialize(): Promise<void> {
    const booksInfo = await getInfoAsync(BOOKS_DIR);
    if (!booksInfo.exists) {
      await makeDirectoryAsync(BOOKS_DIR, { intermediates: true });
    }
    const tempInfo = await getInfoAsync(TEMP_DIR);
    if (!tempInfo.exists) {
      await makeDirectoryAsync(TEMP_DIR, { intermediates: true });
    }
  },

  getBooksDir(): string {
    return BOOKS_DIR;
  },

  getTempDir(): string {
    return TEMP_DIR;
  },

  getBookDir(bookId: string): string {
    return `${BOOKS_DIR}${bookId}/`;
  },

  getTempSessionDir(sessionId: string): string {
    return `${TEMP_DIR}${sessionId}/`;
  },

  async copyToTemp(sourceUri: string, sessionId: string, fileName: string): Promise<string> {
    const tempDir = this.getTempSessionDir(sessionId);
    const tempDirInfo = await getInfoAsync(tempDir);
    if (!tempDirInfo.exists) {
      await makeDirectoryAsync(tempDir, { intermediates: true });
    }
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destPath = `${tempDir}${safeFileName}`;
    await copyAsync({ from: sourceUri, to: destPath });
    return destPath;
  },

  async createBookDir(bookId: string): Promise<string> {
    const bookDir = this.getBookDir(bookId);
    const bookDirInfo = await getInfoAsync(bookDir);
    if (!bookDirInfo.exists) {
      await makeDirectoryAsync(bookDir, { intermediates: true });
    }
    return bookDir;
  },

  async getExtractedDir(bookId: string): Promise<string> {
    const extractDir = `${this.getBookDir(bookId)}extracted/`;
    const info = await getInfoAsync(extractDir);
    if (!info.exists) {
      await makeDirectoryAsync(extractDir, { intermediates: true });
    }
    return extractDir;
  },

  async deleteBookFiles(bookId: string): Promise<void> {
    const bookDir = this.getBookDir(bookId);
    await deleteAsync(bookDir, { idempotent: true });
  },

  async deleteTempSession(sessionId: string): Promise<void> {
    const tempDir = this.getTempSessionDir(sessionId);
    await deleteAsync(tempDir, { idempotent: true });
  },

  async hashFile(filePath: string): Promise<string> {
    const base64 = await readAsStringAsync(filePath, {
      encoding: EncodingType.Base64,
    });
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64,
      { encoding: Crypto.CryptoEncoding.HEX },
    );
  },

  async cleanupOldTemp(): Promise<void> {
    const tempInfo = await getInfoAsync(TEMP_DIR);
    if (!tempInfo.exists) return;

    const sessions = await readDirectoryAsync(TEMP_DIR);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (const session of sessions) {
      const sessionPath = `${TEMP_DIR}${session}`;
      const info = await getInfoAsync(sessionPath);
      if (info.exists && info.modificationTime) {
        const modTime = info.modificationTime * 1000;
        if (now - modTime > oneDay) {
          await deleteAsync(sessionPath, { idempotent: true });
        }
      }
    }
  },

  async getFileSize(path: string): Promise<number> {
    const info = await getInfoAsync(path);
    return info.exists ? info.size ?? 0 : 0;
  },
};
