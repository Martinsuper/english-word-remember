import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, defaultSettings } from '../appState';
import { builtInPacks, getInitialWords } from '../data/builtInPacks';
import { createInitialDeck } from '../domain/review';
import { createDefaultStudyPlan, pruneDailyTasks } from '../domain/studyPlan';
import {
  deckProgressFromDeck,
  mergeProgressIntoDeck,
} from '../domain/deckProgress';
import {
  rebuildDeckFromSource,
  remapIdsByTerm,
  remapReviewLogs,
  sanitizeReviewState,
  sanitizeDeckList,
} from '../domain/wordQuality';
import { MAX_REVIEW_LOGS } from '../appState';
import { DeckEntry } from '../types';

const STORAGE_KEY = 'kaoyan-flashcards.app.v4';
const CUSTOM_PACKS_KEY = 'kaoyan-flashcards.custom-packs.v1';
const LEGACY_STORAGE_KEYS = ['kaoyan-flashcards.app.v3', 'kaoyan-flashcards.app.v2'];

type StoredDeckProgress = {
  id: string;
  state: DeckEntry['state'];
};

type StoredAppState = {
  version: 4;
  activePackId?: string;
  packProgress?: AppState['packProgress'];
  deckProgress: StoredDeckProgress[];
  favoriteIds: string[];
  reviewLogs: AppState['reviewLogs'];
  settings: AppState['settings'];
  searchQuery: string;
  studyPlans: AppState['studyPlans'];
  dailyTasks: AppState['dailyTasks'];
};

let lastSavedCustomPacksJson = '';

function createStateFromWords(words = getInitialWords()): AppState {
  return {
    deck: createInitialDeck(words),
    activePackId: builtInPacks[0]?.id ?? '',
    customPacks: [],
    packProgress: {},
    studyPlans: {
      [builtInPacks[0]?.id ?? '']: createDefaultStudyPlan(builtInPacks[0]?.id ?? ''),
    },
    dailyTasks: {},
    favoriteIds: [],
    reviewLogs: [],
    settings: defaultSettings,
    searchQuery: '',
  };
}

function normalizeStudyPlans(value: unknown, packIds: Set<string>): AppState['studyPlans'] {
  const plans: AppState['studyPlans'] = {};
  if (value && typeof value === 'object') {
    for (const [packId, raw] of Object.entries(value as Record<string, unknown>)) {
      if (!packIds.has(packId) || !raw || typeof raw !== 'object') continue;
      const source = raw as Record<string, unknown>;
      const fallback = createDefaultStudyPlan(packId);
      plans[packId] = {
        ...fallback,
        ...source,
        id: typeof source.id === 'string' ? source.id : fallback.id,
        packId,
        dailyNewWordTarget:
          typeof source.dailyNewWordTarget === 'number'
            ? Math.min(100, Math.max(5, Math.round(source.dailyNewWordTarget)))
            : fallback.dailyNewWordTarget,
        batchSize:
          typeof source.batchSize === 'number'
            ? Math.min(30, Math.max(5, Math.round(source.batchSize)))
            : fallback.batchSize,
        studyWeekdays: Array.isArray(source.studyWeekdays)
          ? source.studyWeekdays.filter((day): day is number => typeof day === 'number' && day >= 0 && day <= 6)
          : fallback.studyWeekdays,
      } as AppState['studyPlans'][string];
    }
  }
  return plans;
}

function normalizeDailyTasks(value: unknown, packIds: Set<string>): AppState['dailyTasks'] {
  if (!value || typeof value !== 'object') return {};
  const result: AppState['dailyTasks'] = {};
  for (const [packId, rawTasks] of Object.entries(value as Record<string, unknown>)) {
    if (!packIds.has(packId) || !rawTasks || typeof rawTasks !== 'object') continue;
    const tasks: AppState['dailyTasks'][string] = {};
    for (const [dateKey, raw] of Object.entries(rawTasks as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const source = raw as Record<string, unknown>;
      const strings = (key: string) => normalizeStringList(source[key]);
      tasks[dateKey] = {
        dateKey,
        planId: typeof source.planId === 'string' ? source.planId : `plan-${packId}`,
        dueReviewIds: strings('dueReviewIds'),
        newWordIds: strings('newWordIds'),
        catchUpWordIds: strings('catchUpWordIds'),
        advancedWordIds: strings('advancedWordIds'),
        advancedTargetDateKey:
          typeof source.advancedTargetDateKey === 'string' ? source.advancedTargetDateKey : undefined,
        completedWordIds: strings('completedWordIds'),
        skippedRelearningIds: strings('skippedRelearningIds'),
        status:
          source.status === 'in_progress' || source.status === 'completed' ? source.status : 'not_started',
        completedAt: typeof source.completedAt === 'string' ? source.completedAt : undefined,
      };
    }
    result[packId] = tasks;
  }
  return result;
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : [];
}

function normalizeReviewLogList(value: unknown) {
  const logs = Array.isArray(value)
    ? value.filter(
        (entry): entry is AppState['reviewLogs'][number] =>
          Boolean(entry) &&
          typeof entry === 'object' &&
          typeof (entry as { id?: unknown }).id === 'string' &&
          typeof (entry as { wordId?: unknown }).wordId === 'string' &&
          typeof (entry as { rating?: unknown }).rating === 'string' &&
          typeof (entry as { reviewedAt?: unknown }).reviewedAt === 'string',
      )
    : [];
  return logs.slice(0, MAX_REVIEW_LOGS);
}

async function getSavedState() {
  const current = await AsyncStorage.getItem(STORAGE_KEY);
  if (current) {
    return current;
  }

  for (const key of LEGACY_STORAGE_KEYS) {
    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      return legacy;
    }
  }

  return null;
}

async function getSavedCustomPacks(fallback: unknown) {
  const saved = await AsyncStorage.getItem(CUSTOM_PACKS_KEY);
  if (saved) {
    try {
      return normalizeCustomPacks(JSON.parse(saved));
    } catch {
      return normalizeCustomPacks(fallback);
    }
  }

  return normalizeCustomPacks(fallback);
}

function normalizeDeckProgress(value: unknown): StoredDeckProgress[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const progress: StoredDeckProgress[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const source = entry as Record<string, unknown>;
    if (typeof source.id !== 'string') {
      continue;
    }

    progress.push({
      id: source.id,
      state: sanitizeReviewState(source.state),
    });
  }

  return progress;
}

function normalizeCustomPacks(value: unknown): AppState['customPacks'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((pack) => {
      if (!pack || typeof pack !== 'object') {
        return null;
      }

      const source = pack as Record<string, unknown>;
      const id = typeof source.id === 'string' ? source.id : '';
      const title = typeof source.title === 'string' ? source.title : '';
      const description = typeof source.description === 'string' ? source.description : '';
      const words = Array.isArray(source.words) ? source.words : [];
      if (!id || !title || words.length === 0) {
        return null;
      }

      return {
        id,
        title,
        description,
        words,
      } as AppState['customPacks'][number];
    })
    .filter((pack): pack is AppState['customPacks'][number] => Boolean(pack));
}

function normalizePackProgress(value: unknown): AppState['packProgress'] {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const progress: AppState['packProgress'] = {};
  for (const [packId, entries] of Object.entries(value as Record<string, unknown>)) {
    progress[packId] = normalizeDeckProgress(entries);
  }
  return progress;
}

function wordsForPack(packId: string, customPacks: AppState['customPacks']) {
  return (
    builtInPacks.find((pack) => pack.id === packId)?.words ??
    customPacks.find((pack) => pack.id === packId)?.words ??
    []
  );
}

export function createDefaultAppState(): AppState {
  return createStateFromWords();
}

export async function loadAppState(): Promise<AppState> {
  const saved = await getSavedState();
  if (!saved) {
    return createDefaultAppState();
  }

  try {
    const parsed = JSON.parse(saved) as Partial<AppState>;
    const customPacks = await getSavedCustomPacks((parsed as { customPacks?: unknown }).customPacks);
    lastSavedCustomPacksJson = JSON.stringify(customPacks);
    const allPackIds = new Set([...builtInPacks.map((pack) => pack.id), ...customPacks.map((pack) => pack.id)]);
    const parsedActivePackId =
      typeof (parsed as { activePackId?: unknown }).activePackId === 'string'
        ? (parsed as { activePackId: string }).activePackId
        : '';
    const activePackId = allPackIds.has(parsedActivePackId)
      ? parsedActivePackId
      : builtInPacks[0]?.id ?? customPacks[0]?.id ?? '';
    const packProgress = normalizePackProgress((parsed as { packProgress?: unknown }).packProgress);
    const studyPlans = normalizeStudyPlans((parsed as { studyPlans?: unknown }).studyPlans, allPackIds);
    const dailyTasks = pruneDailyTasks(normalizeDailyTasks((parsed as { dailyTasks?: unknown }).dailyTasks, allPackIds));
    if (!studyPlans[activePackId]) studyPlans[activePackId] = createDefaultStudyPlan(activePackId);
    const defaultDeck = createInitialDeck(wordsForPack(activePackId, customPacks));

    if (Array.isArray((parsed as { deckProgress?: unknown }).deckProgress)) {
      const progress = normalizeDeckProgress((parsed as { deckProgress?: unknown }).deckProgress);
      const activeProgress = packProgress[activePackId] ?? progress;
      const deck = mergeProgressIntoDeck(defaultDeck, activeProgress);
      return {
        deck,
        activePackId,
        customPacks,
        packProgress: {
          ...packProgress,
          [activePackId]: activeProgress,
        },
        studyPlans,
        dailyTasks,
        favoriteIds: normalizeStringList(parsed.favoriteIds),
        reviewLogs: normalizeReviewLogList(parsed.reviewLogs),
        settings: parsed.settings ? { ...defaultSettings, ...parsed.settings } : defaultSettings,
        searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
      };
    }

    const legacyDeck = sanitizeDeckList(parsed.deck);
    const deck = rebuildDeckFromSource(getInitialWords(), legacyDeck);

    return {
      deck,
      activePackId,
      customPacks,
      packProgress,
      studyPlans,
      dailyTasks,
      favoriteIds: remapIdsByTerm(parsed.favoriteIds, legacyDeck, deck),
      reviewLogs: remapReviewLogs(normalizeReviewLogList(parsed.reviewLogs), legacyDeck, deck),
      settings: parsed.settings ? { ...defaultSettings, ...parsed.settings } : defaultSettings,
      searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
    };
  } catch (error) {
    console.error('[app-state] Failed to load persisted state, falling back to defaults:', error);
    return createDefaultAppState();
  }
}

export async function saveAppState(state: AppState) {
  const activePackProgress = deckProgressFromDeck(state.deck);
  const customPacksJson = JSON.stringify(state.customPacks);
  const payload: StoredAppState = {
    version: 4,
    activePackId: state.activePackId,
    packProgress: {
      ...state.packProgress,
      [state.activePackId]: activePackProgress,
    },
    deckProgress: activePackProgress,
    favoriteIds: state.favoriteIds,
    reviewLogs: state.reviewLogs,
    settings: state.settings,
    searchQuery: state.searchQuery,
    studyPlans: state.studyPlans,
    dailyTasks: pruneDailyTasks(state.dailyTasks),
  };

  if (customPacksJson !== lastSavedCustomPacksJson) {
    await AsyncStorage.setItem(CUSTOM_PACKS_KEY, customPacksJson);
    lastSavedCustomPacksJson = customPacksJson;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearAppState() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(CUSTOM_PACKS_KEY);
  lastSavedCustomPacksJson = '';
  await Promise.all(LEGACY_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key)));
}
