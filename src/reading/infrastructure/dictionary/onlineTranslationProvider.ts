export type OnlineTranslationEntry = {
  term: string;
  meaning: string;
};

const cache = new Map<string, OnlineTranslationEntry | null>();

export async function lookupOnlineTranslation(
  term: string,
  signal?: AbortSignal,
): Promise<OnlineTranslationEntry | null> {
  const key = term.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'zh-CN', dt: 't', q: key });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, { signal });
    if (!response.ok) return null;
    const payload = await response.json() as unknown;
    const segments = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : [];
    const meaning = segments
      .map((segment) => Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : '')
      .join('')
      .trim();
    const result = meaning && meaning.toLowerCase() !== key
      ? { term: key, meaning }
      : null;
    cache.set(key, result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    return null;
  }
}
