import { DeckEntry, Word } from '../types';

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？,.!?/\\\-]/g, '');
}

export function matchesQuery(text: string, query: string) {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) {
    return true;
  }
  return normalize(text).includes(normalizedQuery);
}

export function filterWords<T extends Word | DeckEntry>(items: T[], query: string) {
  const q = query.trim();
  if (!q) {
    return items;
  }
  return items.filter((item) => {
    const fields = [item.term, item.meaning, item.example, item.exampleMeaning, item.phonetic];
    return fields.some((field) => matchesQuery(field, q));
  });
}

