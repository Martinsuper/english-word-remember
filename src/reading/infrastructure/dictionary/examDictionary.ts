import { wordFormCandidates } from '../../domain/localDictionary';

export type ExamVocabularyTag = '四级词汇' | '六级词汇' | '考研词汇';

export type ExamDictionaryEntry = {
  term: string;
  phonetic: string;
  meaning: string;
  tags: ExamVocabularyTag[];
};

export type ExamDictionaryMatch = ExamDictionaryEntry & { queriedTerm: string };

// 词典 JSON（约 600KB）只在首次查询时解析构建，避免计入启动开销。
let dictionary: Map<string, ExamDictionaryEntry> | null = null;

function getDictionary(): Map<string, ExamDictionaryEntry> {
  if (!dictionary) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require('./examDictionary.json') as ExamDictionaryEntry[];
    dictionary = new Map(data.map((entry) => [entry.term, entry]));
  }
  return dictionary;
}

export function lookupExamDictionary(rawTerm: string): ExamDictionaryMatch | null {
  const byTerm = getDictionary();
  for (const candidate of wordFormCandidates(rawTerm)) {
    const entry = byTerm.get(candidate);
    if (entry) return { ...entry, queriedTerm: candidate };
  }
  return null;
}
