import { Word, WordExample } from '../types';

const MAX_EXAMPLES = 10;

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function sanitizeWordExamples(value: unknown): WordExample[] {
  let parsed = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
      const source = candidate as Record<string, unknown>;
      const sense = clean(source.sense ?? source.meaning ?? source.definition);
      const sentence = clean(source.sentence ?? source.example);
      const translation = clean(
        source.translation ?? source.exampleMeaning ?? source.exampleTranslation,
      );
      if (!sentence || !translation) return null;
      return { sense, sentence, translation };
    })
    .filter((example): example is WordExample => Boolean(example))
    .slice(0, MAX_EXAMPLES);
}

export function examplesFromCandidate(source: Record<string, unknown>) {
  const structured = sanitizeWordExamples(
    source.examples ?? source.examplesJson ?? source.exampleJson ?? source['例句JSON'],
  );
  if (structured.length > 0) return structured;

  const sentence = clean(source.example ?? source.sentence);
  const translation = clean(
    source.exampleMeaning ?? source.example_translation ?? source.exampleTranslation,
  );
  return sentence ? [{ sense: '', sentence, translation }] : [];
}

export function getWordExamples(word: Pick<Word, 'examples' | 'example' | 'exampleMeaning'>) {
  const structured = sanitizeWordExamples(word.examples);
  if (structured.length > 0) return structured;
  const sentence = clean(word.example);
  return sentence ? [{ sense: '', sentence, translation: clean(word.exampleMeaning) }] : [];
}
