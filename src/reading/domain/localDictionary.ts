import type { Word, WordPack } from '../../types';
import { normalizeWord } from './wordSelection';

export type LocalDictionaryMatch = { word: Word; queriedTerm: string };

// 每个 pack 只建一次归一化索引，避免每次点词都全量 flatMap + new Map。
const packIndexCache = new WeakMap<WordPack, Map<string, Word>>();

function getPackIndex(pack: WordPack): Map<string, Word> {
  let index = packIndexCache.get(pack);
  if (!index) {
    index = new Map(pack.words.map((word) => [normalizeWord(word.term), word]));
    packIndexCache.set(pack, index);
  }
  return index;
}

export function lookupLocalWord(packs: WordPack[], rawTerm: string): LocalDictionaryMatch | null {
  // 倒序遍历、首个命中即返回，等价于原先"后包覆盖先包"的单 Map 语义。
  for (let packIndex = packs.length - 1; packIndex >= 0; packIndex--) {
    const byTerm = getPackIndex(packs[packIndex]);
    for (const candidate of wordFormCandidates(rawTerm)) {
      const word = byTerm.get(candidate);
      if (word) return { word, queriedTerm: candidate };
    }
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
