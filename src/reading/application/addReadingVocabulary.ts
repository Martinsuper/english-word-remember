import type { ReadingLocator } from '../domain/models';
import { wordContextRepository } from '../infrastructure/database/repositories/wordContextRepository';
import { normalizeWord } from '../domain/wordSelection';
import { generateId } from '../../utils/generateId';

export const READING_PACK_ID = 'reading-vocabulary';

export type AddReadingWordInput = {
  wordId: string;
  surfaceForm: string;
  phonetic?: string;
  meaning?: string;
  sentence: string;
  bookId: string;
  chapterId: string;
  locator: ReadingLocator;
};

export type AddReadingWordResult =
  | { status: 'created'; wordId: string }
  | { status: 'context_added'; wordId: string }
  | { status: 'already_exists'; wordId: string };

export async function addReadingWord(input: AddReadingWordInput): Promise<AddReadingWordResult> {
  const normalized = normalizeWord(input.surfaceForm);
  const wordId = input.wordId;

  const existing = await wordContextRepository.findByWordId(wordId);
  const sameContext = existing.find(
    (ctx) =>
      ctx.bookId === input.bookId &&
      ctx.chapterId === input.chapterId &&
      ctx.locator.chapterId === input.locator.chapterId &&
      ctx.sentence.trim() === input.sentence.trim(),
  );

  if (sameContext) {
    return { status: 'already_exists', wordId };
  }

  const context = {
    id: `ctx_${generateId()}`,
    wordId,
    normalizedTerm: normalized,
    surfaceForm: input.surfaceForm,
    bookId: input.bookId,
    chapterId: input.chapterId,
    locator: input.locator,
    sentence: input.sentence,
    createdAt: new Date().toISOString(),
    isPrimary: existing.length === 0,
  };

  await wordContextRepository.createContext(context);

  return {
    status: existing.length > 0 ? 'context_added' : 'created',
    wordId,
  };
}
