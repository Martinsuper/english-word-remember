import { createInitialDeck } from './review';
import { DeckEntry, Word } from '../types';
import { examplesFromCandidate } from './wordExamples';

const ENGLISH_TERM_RE = /^[A-Za-z][A-Za-z0-9'’().\/\-\s]*$/;
const HAS_LETTER_RE = /[A-Za-z]/;
const CJK_RE = /[\u4e00-\u9fff]/;

export function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function normalizeWordId(term: string) {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'word';
}

function looksLikeEnglishTerm(term: string) {
  return term.length > 0 && term.length <= 64 && HAS_LETTER_RE.test(term) && ENGLISH_TERM_RE.test(term);
}

function looksLikeUsefulMeaning(value: string) {
  return value.length === 0 || (value.length <= 300 && (CJK_RE.test(value) || HAS_LETTER_RE.test(value)));
}

export function sanitizeWordCandidate(candidate: unknown): Word | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const source = candidate as Record<string, unknown>;
  const term = normalizeText(source.term ?? source.word ?? source.vocab ?? source.title);
  if (!looksLikeEnglishTerm(term)) {
    return null;
  }

  const meaning = normalizeText(source.meaning ?? source.definition ?? source.translation);
  const examples = examplesFromCandidate(source);
  const example = examples[0]?.sentence ?? '';
  const exampleMeaning = examples[0]?.translation ?? '';

  if (!looksLikeUsefulMeaning(meaning) || !looksLikeUsefulMeaning(exampleMeaning)) {
    return null;
  }

  return {
    id: normalizeText(source.id) || normalizeWordId(term),
    term,
    phonetic: normalizeText(source.phonetic ?? source.ipa),
    meaning,
    example,
    exampleMeaning,
    examples,
    tags: Array.isArray(source.tags)
      ? source.tags.filter((tag): tag is string => typeof tag === 'string').map(normalizeText).filter(Boolean)
      : undefined,
    sourceBook: normalizeText(source.sourceBook ?? source.book),
    sourcePage:
      typeof source.sourcePage === 'number' && Number.isFinite(source.sourcePage)
        ? source.sourcePage
        : undefined,
    rawText: normalizeText(source.rawText ?? source.text ?? source.content),
  };
}

export function sanitizeWordList(words: unknown) {
  const list = Array.isArray(words) ? words : [];
  const seen = new Set<string>();

  return list
    .map(sanitizeWordCandidate)
    .filter((word): word is Word => Boolean(word))
    .filter((word) => {
      const key = word.id || normalizeWordId(word.term);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((word) => ({
      ...word,
      id: word.id || normalizeWordId(word.term),
    }));
}

export function sanitizeReviewState(value: unknown) {
  const state = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const nextReviewAt =
    typeof state.nextReviewAt === 'string' && !Number.isNaN(new Date(state.nextReviewAt).getTime())
      ? state.nextReviewAt
      : undefined;
  const lastReviewedAt =
    typeof state.lastReviewedAt === 'string' && !Number.isNaN(new Date(state.lastReviewedAt).getTime())
      ? state.lastReviewedAt
      : undefined;
  const introducedAt =
    typeof state.introducedAt === 'string' && !Number.isNaN(new Date(state.introducedAt).getTime())
      ? state.introducedAt
      : lastReviewedAt;

  return {
    introducedAt,
    learningStep:
      typeof state.learningStep === 'number' && Number.isFinite(state.learningStep)
        ? Math.max(0, Math.round(state.learningStep))
        : 0,
    easeFactor:
      typeof state.easeFactor === 'number' && Number.isFinite(state.easeFactor)
        ? Math.max(1.3, Number(state.easeFactor.toFixed(2)))
        : 2.5,
    intervalDays:
      typeof state.intervalDays === 'number' && Number.isFinite(state.intervalDays)
        ? Math.max(0, Math.round(state.intervalDays))
        : 0,
    repetition:
      typeof state.repetition === 'number' && Number.isFinite(state.repetition)
        ? Math.max(0, Math.round(state.repetition))
        : 0,
    nextReviewAt,
    lastReviewedAt,
    correctCount:
      typeof state.correctCount === 'number' && Number.isFinite(state.correctCount)
        ? Math.max(0, Math.round(state.correctCount))
        : 0,
    wrongCount:
      typeof state.wrongCount === 'number' && Number.isFinite(state.wrongCount)
        ? Math.max(0, Math.round(state.wrongCount))
        : 0,
  };
}

export function sanitizeDeckEntry(candidate: unknown): DeckEntry | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const source = candidate as Record<string, unknown>;
  const word = sanitizeWordCandidate(source);
  if (!word) {
    return null;
  }

  return {
    ...word,
    state: sanitizeReviewState(source.state),
  };
}

export function sanitizeDeckList(deck: unknown) {
  const list = Array.isArray(deck) ? deck : [];
  const seen = new Set<string>();

  return list
    .map(sanitizeDeckEntry)
    .filter((entry): entry is DeckEntry => Boolean(entry))
    .filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
}

export function rebuildDeckFromSource(sourceWords: Word[], legacyDeck: DeckEntry[] = []) {
  const legacyById = new Map(legacyDeck.map((entry) => [entry.id, entry]));
  const legacyByTerm = new Map(legacyDeck.map((entry) => [normalizeWordId(entry.term), entry]));
  const initialDeck = createInitialDeck(sourceWords);

  return initialDeck.map((entry, index) => {
    const legacy =
      legacyById.get(entry.id) ??
      legacyByTerm.get(normalizeWordId(entry.term)) ??
      legacyDeck[index];

    return legacy
      ? {
          ...entry,
          state: legacy.state,
        }
      : entry;
  });
}

export function remapIdsByTerm(ids: unknown, legacyDeck: DeckEntry[], nextDeck: DeckEntry[]) {
  const idList = Array.isArray(ids) ? ids : [];
  const nextById = new Map(nextDeck.map((entry) => [entry.id, entry]));
  const nextByTerm = new Map(nextDeck.map((entry) => [normalizeWordId(entry.term), entry.id]));
  const legacyById = new Map(legacyDeck.map((entry) => [entry.id, entry]));

  return idList
    .map((id) => {
      if (typeof id !== 'string') {
        return '';
      }
      if (nextById.has(id)) {
        return id;
      }
      const legacy = legacyById.get(id);
      if (!legacy) {
        return '';
      }
      return nextByTerm.get(normalizeWordId(legacy.term)) ?? '';
    })
    .filter(Boolean);
}

export function remapReviewLogs(logs: unknown, legacyDeck: DeckEntry[], nextDeck: DeckEntry[]) {
  const list = Array.isArray(logs) ? logs : [];
  const nextById = new Set(nextDeck.map((entry) => entry.id));
  const nextByTerm = new Map(nextDeck.map((entry) => [normalizeWordId(entry.term), entry.id]));
  const legacyById = new Map(legacyDeck.map((entry) => [entry.id, entry]));

  return list
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const source = entry as Record<string, unknown>;
      if (
        typeof source.id !== 'string' ||
        typeof source.wordId !== 'string' ||
        typeof source.rating !== 'string' ||
        typeof source.reviewedAt !== 'string'
      ) {
        return null;
      }

      const directWordId = nextById.has(source.wordId) ? source.wordId : '';
      const legacy = legacyById.get(source.wordId);
      const remappedWordId =
        directWordId || (legacy ? nextByTerm.get(normalizeWordId(legacy.term)) ?? '' : '');

      if (!remappedWordId) {
        return null;
      }

      return {
        id: source.id,
        wordId: remappedWordId,
        rating: source.rating as 'again' | 'hard' | 'good',
        reviewedAt: source.reviewedAt,
      };
    })
    .filter((entry): entry is { id: string; wordId: string; rating: 'again' | 'hard' | 'good'; reviewedAt: string } =>
      Boolean(entry),
    );
}
