import { DeckEntry, ReviewRating, Word } from '../types';

const AGAIN_REVIEW_DELAY_MINUTES = 10;

export type ReviewStats = {
  mastered: number;
  due: number;
  todayReviewed: number;
  total: number;
};

export function localDateKey(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
}

export function isDue(entry: DeckEntry, now = new Date()) {
  return Boolean(
    (entry.state.introducedAt || entry.state.lastReviewedAt) &&
      entry.state.nextReviewAt &&
      new Date(entry.state.nextReviewAt).getTime() <= now.getTime(),
  );
}

export function createInitialDeck(words: Word[]): DeckEntry[] {
  return words.map((word) => ({
    ...word,
    state: {
      learningStep: 0,
      easeFactor: 2.5,
      intervalDays: 0,
      repetition: 0,
      correctCount: 0,
      wrongCount: 0,
    },
  }));
}

function qualityForRating(rating: ReviewRating) {
  if (rating === 'again') {
    return 2;
  }
  if (rating === 'hard') {
    return 3;
  }
  return 5;
}

function clampEaseFactor(value: number) {
  return Math.max(1.3, Number(value.toFixed(2)));
}

function nextIntervalDays(previousInterval: number, repetition: number, easeFactor: number, rating: ReviewRating) {
  const quality = qualityForRating(rating);
  if (quality < 3) {
    return 1;
  }
  if (repetition === 0) {
    return rating === 'hard' ? 1 : 1;
  }
  if (repetition === 1) {
    return rating === 'hard' ? 3 : 6;
  }
  const base = Math.max(1, Math.round(previousInterval * easeFactor));
  if (rating === 'hard') {
    return Math.max(1, Math.round(base * 0.6));
  }
  return base;
}

export function applyReview(entry: DeckEntry, rating: ReviewRating): DeckEntry {
  const now = new Date();
  const quality = qualityForRating(rating);
  const failed = quality < 3;

  let repetition = entry.state.repetition;
  let intervalDays = entry.state.intervalDays;
  let easeFactor = entry.state.easeFactor;

  if (failed) {
    repetition = 0;
    intervalDays = 0;
  } else {
    const nextRepetition = repetition + 1;
    if (nextRepetition === 1) {
      intervalDays = 1;
    } else if (nextRepetition === 2) {
      intervalDays = rating === 'hard' ? 3 : 6;
    } else {
      intervalDays = nextIntervalDays(intervalDays, repetition, easeFactor, rating);
    }
    repetition = nextRepetition;
    easeFactor = clampEaseFactor(
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );
  }

  const nextReviewDelay = failed
    ? AGAIN_REVIEW_DELAY_MINUTES * 60 * 1000
    : intervalDays * 24 * 60 * 60 * 1000;
  const nextReviewAt = new Date(now.getTime() + nextReviewDelay).toISOString();

  return {
    ...entry,
    state: {
      ...entry.state,
      introducedAt: entry.state.introducedAt ?? now.toISOString(),
      learningStep: failed ? 0 : entry.state.learningStep + 1,
      easeFactor,
      intervalDays,
      repetition,
      nextReviewAt,
      lastReviewedAt: now.toISOString(),
      correctCount: failed ? entry.state.correctCount : entry.state.correctCount + 1,
      wrongCount: failed ? entry.state.wrongCount + 1 : entry.state.wrongCount,
    },
  };
}

export function getStats(deck: DeckEntry[]): ReviewStats {
  const today = localDateKey();
  const now = new Date();
  let mastered = 0;
  let due = 0;
  let todayReviewed = 0;

  for (const entry of deck) {
    if (entry.state.intervalDays >= 21 && Boolean(entry.state.lastReviewedAt)) {
      mastered += 1;
    }
    if (isDue(entry, now)) {
      due += 1;
    }
    if (entry.state.lastReviewedAt && localDateKey(new Date(entry.state.lastReviewedAt)) === today) {
      todayReviewed += 1;
    }
  }

  return { mastered, due, todayReviewed, total: deck.length };
}

export function chooseActiveWordId(deck: DeckEntry[], activeWordId?: string) {
  const now = new Date();
  let firstDueId: string | undefined;

  for (const entry of deck) {
    if (!isDue(entry, now)) {
      continue;
    }
    if (!firstDueId) {
      firstDueId = entry.id;
    }
    if (activeWordId && entry.id === activeWordId) {
      return activeWordId;
    }
  }

  return firstDueId;
}

export function getWordProgressLabel(entry: DeckEntry) {
  if (entry.state.repetition === 0) {
    return '新词';
  }
  if (entry.state.intervalDays >= 21) {
    return '已掌握';
  }
  return `第 ${entry.state.repetition} 轮复习`;
}
