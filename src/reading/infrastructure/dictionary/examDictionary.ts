import dictionaryData from './examDictionary.json';
import { wordFormCandidates } from '../../domain/localDictionary';

export type ExamVocabularyTag = '四级词汇' | '六级词汇' | '考研词汇';

export type ExamDictionaryEntry = {
  term: string;
  phonetic: string;
  meaning: string;
  tags: ExamVocabularyTag[];
};

export type ExamDictionaryMatch = ExamDictionaryEntry & { queriedTerm: string };

const dictionary = new Map(
  (dictionaryData as ExamDictionaryEntry[]).map((entry) => [entry.term, entry]),
);

export function lookupExamDictionary(rawTerm: string): ExamDictionaryMatch | null {
  for (const candidate of wordFormCandidates(rawTerm)) {
    const entry = dictionary.get(candidate);
    if (entry) return { ...entry, queriedTerm: candidate };
  }
  return null;
}
