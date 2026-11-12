import { DeckEntry } from '../types';

export type DeckProgress = {
  id: string;
  state: DeckEntry['state'];
};

export function hasLearningProgress(entry: DeckEntry): boolean {
  return (
    entry.state.repetition > 0 ||
    entry.state.correctCount > 0 ||
    entry.state.wrongCount > 0 ||
    Boolean(entry.state.lastReviewedAt)
  );
}

export function deckProgressFromDeck(deck: DeckEntry[]): DeckProgress[] {
  return deck.filter(hasLearningProgress).map((entry) => ({ id: entry.id, state: entry.state }));
}

export function mergeProgressIntoDeck(
  deck: DeckEntry[],
  progress: DeckProgress[],
): DeckEntry[] {
  if (progress.length === 0) {
    return deck;
  }

  const progressById = new Map(progress.map((entry) => [entry.id, entry.state]));
  return deck.map((entry) => {
    const state = progressById.get(entry.id);
    return state ? { ...entry, state } : entry;
  });
}
