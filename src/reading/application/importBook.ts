import { writeAsStringAsync, moveAsync } from 'expo-file-system/legacy';
import { readingFileStore } from '../infrastructure/files/readingFileStore';
import { parseEpubFile, extractCoverImage, extractEpubResources, EpubImportError } from '../infrastructure/epub/parseEpub';
import { resolveResourcePath } from '../infrastructure/epub/resolveResource';
import { bookRepository } from '../infrastructure/database/repositories/bookRepository';
import type { ReadingBook, ReadingChapter } from '../domain/models';
import { generateId } from '../../utils/generateId';

export type ImportStage = 'copying' | 'validating' | 'parsing' | 'extracting' | 'committing';

export type ImportProgress = {
  stage: ImportStage;
  percent: number;
};

export type ImportResult = {
  bookId: string;
  duplicate: boolean;
};

export async function importBook(
  sourceUri: string,
  fileName: string,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const sessionId = `import_${generateId()}`;
  let createdBookId: string | null = null;

  try {
    onProgress?.({ stage: 'copying', percent: 0 });
    const tempPath = await readingFileStore.copyToTemp(sourceUri, sessionId, fileName);
    onProgress?.({ stage: 'copying', percent: 100 });

    onProgress?.({ stage: 'validating', percent: 0 });
    const sourceSize = await readingFileStore.getFileSize(tempPath);
    if (sourceSize > 100 * 1024 * 1024) {
      throw new EpubImportError('ZIP_SAFETY_LIMIT', 'EPUB 文件不能超过 100MB');
    }
    const contentHash = await readingFileStore.hashFile(tempPath);

    const existingBook = await bookRepository.findByContentHash(contentHash);
    if (existingBook) {
      await readingFileStore.deleteTempSession(sessionId);
      return { bookId: existingBook.id, duplicate: true };
    }
    onProgress?.({ stage: 'validating', percent: 100 });

    onProgress?.({ stage: 'parsing', percent: 0 });
    const parsed = await parseEpubFile(tempPath);
    onProgress?.({ stage: 'parsing', percent: 100 });

    onProgress?.({ stage: 'extracting', percent: 0 });
    const bookId = `book_${generateId()}`;
    createdBookId = bookId;
    const bookDir = await readingFileStore.createBookDir(bookId);
    const extractDir = await readingFileStore.getExtractedDir(bookId);

    await extractEpubResources(tempPath, extractDir, parsed.resourcePaths);
    for (const chapter of parsed.chapters) {
      const chapterFileName = `chapter_${chapter.spineIndex}.html`;
      const chapterPath = `${extractDir}${chapterFileName}`;
      await writeAsStringAsync(
        chapterPath,
        rewriteResourceUrls(chapter.sanitizedHtml, chapter.archivePath, extractDir),
      );
    }

    let coverPath: string | undefined;
    if (parsed.coverPath) {
      const coverOutputPath = `${bookDir}${parsed.coverPath}`;
      const success = await extractCoverImage(tempPath, coverOutputPath);
      if (success) {
        coverPath = coverOutputPath;
      }
    }

    const fileSize = await readingFileStore.getFileSize(tempPath);

    const book: ReadingBook = {
      id: bookId,
      contentHash,
      title: parsed.title,
      author: parsed.author,
      publisher: parsed.publisher,
      language: parsed.language,
      description: parsed.description,
      coverPath,
      sourceType: 'local_import',
      originalFileName: fileName,
      epubVersion: parsed.epubVersion,
      status: 'ready',
      fileSize,
      importedAt: new Date().toISOString(),
    };

    const chapters: ReadingChapter[] = parsed.chapters.map((ch) => ({
      id: `${bookId}_ch_${ch.spineIndex}`,
      bookId,
      spineIndex: ch.spineIndex,
      title: ch.title,
      href: ch.href,
      mediaType: ch.mediaType,
      extractedPath: `${extractDir}chapter_${ch.spineIndex}.html`,
      linear: ch.linear,
    }));

    onProgress?.({ stage: 'extracting', percent: 100 });

    onProgress?.({ stage: 'committing', percent: 0 });
    await moveAsync({ from: tempPath, to: `${bookDir}original.epub` });
    await bookRepository.createBookWithChapters(book, chapters);
    await readingFileStore.deleteTempSession(sessionId);

    onProgress?.({ stage: 'committing', percent: 100 });

    return { bookId, duplicate: false };
  } catch (error) {
    await readingFileStore.deleteTempSession(sessionId).catch(() => {});
    if (createdBookId) await readingFileStore.deleteBookFiles(createdBookId).catch(() => {});

    if (error instanceof EpubImportError) {
      throw error;
    }

    throw new EpubImportError('INVALID_ZIP', `Import failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

function rewriteResourceUrls(html: string, chapterArchivePath: string, extractDir: string) {
  const chapterDir = chapterArchivePath.includes('/')
    ? chapterArchivePath.slice(0, chapterArchivePath.lastIndexOf('/') + 1)
    : '';
  return html.replace(/\b(src|poster)="([^"]+)"/gi, (match, attribute, rawHref) => {
    if (/^(?:https?:|data:|#)/i.test(rawHref)) return match;
    const resolved = resolveResourcePath(chapterDir, rawHref.split('#')[0]);
    return `${attribute}="${extractDir}${resolved}"`;
  });
}
