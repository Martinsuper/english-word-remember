import type { Word, WordPack } from '../../types';
import { normalizeWord } from './wordSelection';

export type LocalDictionaryMatch = { word: Word; queriedTerm: string };

export function lookupLocalWord(packs: WordPack[], rawTerm: string): LocalDictionaryMatch | null {
  const words = packs.flatMap((pack) => pack.words);
  const byTerm = new Map(words.map((word) => [normalizeWord(word.term), word]));
  for (const candidate of wordFormCandidates(rawTerm)) {
    const word = byTerm.get(candidate);
    if (word) return { word, queriedTerm: candidate };
  }
  return null;
}

export function wordFormCandidates(rawTerm: string): string[] {
  const term = normalizeWord(rawTerm);
  const candidates = [term];
  const add = (value: string) => {
    if (value.length > 1 && !candidates.includes(value)) candidates.push(value);
  };
  const irregularForms: Record<string, string[]> = {
    am: ['be'], is: ['be'], are: ['be'], was: ['be'], were: ['be'], been: ['be'],
    went: ['go'], gone: ['go'], did: ['do'], done: ['do'], had: ['have'],
    made: ['make'], took: ['take'], taken: ['take'], came: ['come'], became: ['become'],
    got: ['get'], gotten: ['get'], gave: ['give'], given: ['give'], saw: ['see'], seen: ['see'],
    knew: ['know'], known: ['know'], thought: ['think'], bought: ['buy'], brought: ['bring'],
    found: ['find'], felt: ['feel'], left: ['leave'], kept: ['keep'], held: ['hold'],
    wrote: ['write'], written: ['write'], spoke: ['speak'], spoken: ['speak'],
    children: ['child'], men: ['man'], women: ['woman'], people: ['person'],
    feet: ['foot'], teeth: ['tooth'], mice: ['mouse'], geese: ['goose'],
    better: ['good'], best: ['good'], worse: ['bad'], worst: ['bad'],
  };
  for (const base of irregularForms[term] ?? []) add(base);
  if (term.endsWith('ies') && term.length > 4) add(`${term.slice(0, -3)}y`);
  if (term.endsWith('ves') && term.length > 4) {
    add(`${term.slice(0, -3)}f`);
    add(`${term.slice(0, -3)}fe`);
  }
  if (term.endsWith('ing') && term.length > 5) {
    const stem = term.slice(0, -3);
    add(stem);
    add(`${stem}e`);
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) add(stem.slice(0, -1));
  }
  if (term.endsWith('ed') && term.length > 4) {
    const stem = term.slice(0, -2);
    add(stem);
    add(`${stem}e`);
    if (stem.endsWith('i')) add(`${stem.slice(0, -1)}y`);
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) add(stem.slice(0, -1));
  }
  if (term.endsWith('es') && term.length > 3) {
    add(term.slice(0, -2));
    add(term.slice(0, -1));
  } else if (term.endsWith('s') && term.length > 3) {
    add(term.slice(0, -1));
  }
  if (term.endsWith('ly') && term.length > 4) add(term.slice(0, -2));
  if (term.endsWith('er') && term.length > 4) add(term.slice(0, -2));
  if (term.endsWith('est') && term.length > 5) add(term.slice(0, -3));
  return candidates;
}
