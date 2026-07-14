import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { wordFormCandidates } from '../../domain/localDictionary';

export type EcdictEntry = {
  term: string;
  queriedTerm: string;
  phonetic: string;
  meaning: string;
  englishDefinition: string;
  tags: string[];
};

type EcdictRow = {
  word: string;
  phonetic: string;
  definition: string;
  translation: string;
  tag: string;
  exchange: string;
};

const DATABASE_NAME = 'ecdict-v20250102.db';
const SOURCE_COMMIT = '82c9872576b23118d7c42e920c11beb77f510ae2';
const TAG_NAMES: Record<string, string> = {
  zk: '中考词汇', gk: '高考词汇', cet4: '四级词汇', cet6: '六级词汇',
  ky: '考研词汇', toefl: '托福词汇', ielts: '雅思词汇', gre: 'GRE词汇',
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
const resultCache = new Map<string, EcdictEntry | null>();

async function getEcdictDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = (async () => {
    await SQLite.importDatabaseFromAssetAsync(DATABASE_NAME, {
      assetId: require('../../../../assets/dictionaries/ecdict-v20250102.db'),
    });
    let database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    const metadata = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM metadata WHERE key = 'source_commit'",
    ).catch(() => null);
    if (metadata?.value === SOURCE_COMMIT) return database;

    await database.closeAsync();
    await SQLite.importDatabaseFromAssetAsync(DATABASE_NAME, {
      assetId: require('../../../../assets/dictionaries/ecdict-v20250102.db'),
      forceOverwrite: true,
    });
    database = await SQLite.openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
    return database;
  })().catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

export async function lookupEcdict(rawTerm: string): Promise<EcdictEntry | null> {
  const key = rawTerm.trim().toLowerCase();
  if (!key || Platform.OS === 'web') return null;
  if (resultCache.has(key)) return resultCache.get(key) ?? null;

  try {
    const database = await getEcdictDatabase();
    for (const candidate of wordFormCandidates(key)) {
      const row = await database.getFirstAsync<EcdictRow>(
        `SELECT word, phonetic, definition, translation, tag, exchange
         FROM dictionary WHERE word = ? COLLATE NOCASE LIMIT 1`,
        candidate,
      );
      if (!row || (!row.translation && !row.definition)) continue;
      const result: EcdictEntry = {
        term: row.word,
        queriedTerm: candidate,
        phonetic: row.phonetic,
        meaning: row.translation || row.definition,
        englishDefinition: row.definition,
        tags: row.tag.split(/\s+/).map((tag) => TAG_NAMES[tag]).filter(Boolean),
      };
      resultCache.set(key, result);
      return result;
    }
  } catch (error) {
    console.warn('ECDICT lookup failed:', error);
  }
  resultCache.set(key, null);
  return null;
}
