export type BookStatus = 'importing' | 'ready' | 'failed' | 'deleting';

export type ReadingBook = {
  id: string;
  contentHash: string;
  title: string;
  author?: string;
  publisher?: string;
  language?: string;
  description?: string;
  coverPath?: string;
  sourceType: 'local_import' | 'remote_catalog';
  sourceRef?: string;
  originalFileName?: string;
  epubVersion?: string;
  status: BookStatus;
  fileSize: number;
  importedAt: string;
  lastOpenedAt?: string;
};

export type ReadingChapter = {
  id: string;
  bookId: string;
  spineIndex: number;
  title: string;
  href: string;
  mediaType: string;
  extractedPath: string;
  linear: boolean;
};

export type ReadingLocator = {
  chapterId: string;
  progression?: number;
  elementId?: string;
  textBefore?: string;
  textQuote?: string;
  textAfter?: string;
};

export type ReadingProgress = {
  bookId: string;
  locator: ReadingLocator;
  overallProgress: number;
  updatedAt: string;
};

export type WordContext = {
  id: string;
  wordId: string;
  normalizedTerm: string;
  surfaceForm: string;
  bookId: string;
  chapterId: string;
  locator: ReadingLocator;
  sentence: string;
  createdAt: string;
  isPrimary: boolean;
};
