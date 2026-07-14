import { wordFormCandidates } from '../../domain/localDictionary';

export type OnlineDictionaryEntry = {
  term: string;
  phonetic: string;
  meaning: string;
};

const cache = new Map<string, OnlineDictionaryEntry | null>();

export async function lookupFreeDictionary(
  term: string,
  signal?: AbortSignal,
): Promise<OnlineDictionaryEntry | null> {
  for (const candidate of wordFormCandidates(term)) {
    const result = await lookupExact(candidate, signal);
    if (result) return result;
  }
  return null;
}

async function lookupExact(term: string, signal?: AbortSignal): Promise<OnlineDictionaryEntry | null> {
  const key = term.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`, { signal });
    if (!response.ok) {
      cache.set(key, null);
      return null;
    }
    const payload = await response.json() as Array<{
      word?: string;
      phonetic?: string;
      phonetics?: Array<{ text?: string }>;
      meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string }> }>;
    }>;
    const first = payload[0];
    if (!first) return null;
    const definitions = (first.meanings ?? [])
      .flatMap((meaning) => (meaning.definitions ?? []).slice(0, 2).map((item) =>
        `${meaning.partOfSpeech ? `${meaning.partOfSpeech}. ` : ''}${item.definition ?? ''}`.trim(),
      ))
      .filter(Boolean)
      .slice(0, 4);
    const result = definitions.length > 0 ? {
      term: first.word ?? key,
      phonetic: first.phonetic ?? first.phonetics?.find((item) => item.text)?.text ?? '',
      meaning: definitions.join('\n'),
    } : null;
    cache.set(key, result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    return null;
  }
}
