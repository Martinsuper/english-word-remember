import { useEffect, useMemo, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { AppSettings, AppState, ReviewLogEntry, defaultSettings } from '../appState';
import { builtInPacks } from '../data/builtInPacks';
import { applyReview, chooseActiveWordId, createInitialDeck, getStats, isDue } from '../domain/review';
import { filterWords } from '../domain/text';
import { clearAppState, createDefaultAppState, loadAppState, saveAppState } from '../storage/appStateStorage';
import { sanitizeWordList } from '../domain/wordQuality';
import { DeckEntry, ReviewRating, StudyPlan, Word } from '../types';
import {
  addAdvancedWords,
  completeTaskWord,
  createDailyTask,
  createDefaultStudyPlan,
  estimatedCompletionDate,
  getStudyDateKey,
  isIntroduced,
  remainingTaskIds,
  requiredTaskIds,
  taskTypeForWord,
} from '../domain/studyPlan';
import {
  cancelReminderNotifications,
  requestReminderPermission,
  scheduleDailyReminder,
} from '../services/notificationService';

function makeReviewLog(wordId: string, rating: ReviewRating): ReviewLogEntry {
  return {
    id: `${wordId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    wordId,
    rating,
    reviewedAt: new Date().toISOString(),
  };
}

function hasLearningProgress(entry: DeckEntry) {
  return (
    entry.state.repetition > 0 ||
    entry.state.correctCount > 0 ||
    entry.state.wrongCount > 0 ||
    Boolean(entry.state.lastReviewedAt)
  );
}

function deckProgressFromDeck(deck: DeckEntry[]) {
  return deck.filter(hasLearningProgress).map((entry) => ({ id: entry.id, state: entry.state }));
}

function buildDeckFromWords(words: Word[], progress: ReturnType<typeof deckProgressFromDeck> = []) {
  const baseDeck = createInitialDeck(words);
  if (progress.length === 0) {
    return baseDeck;
  }

  const progressById = new Map(progress.map((entry) => [entry.id, entry.state]));
  return baseDeck.map((entry) => {
    const state = progressById.get(entry.id);
    return state ? { ...entry, state } : entry;
  });
}

function makeImportedPackId(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `custom-${slug || 'words'}-${Date.now().toString(36)}`;
}

export const READING_PACK_ID = 'reading-vocabulary';

export type ReadingWordInput = {
  term: string;
  phonetic?: string;
  meaning?: string;
  tags?: string[];
  sentence: string;
  sourceBook: string;
};

export function useAppState() {
  const [state, setState] = useState<AppState>(() => createDefaultAppState());
  const [hydrated, setHydrated] = useState(false);
  const [scheduleTick, setScheduleTick] = useState(0);
  const reminderReadyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      const loaded = await loadAppState();
      setState(loaded);
      setHydrated(true);
    };
    hydrate();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setScheduleTick((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveAppState(state).catch(() => undefined);
    }, 400);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const syncReminder = async () => {
      const { reminderEnabled, reminderHour, reminderMinute } = state.settings;
      if (!reminderEnabled) {
        reminderReadyRef.current = false;
        await cancelReminderNotifications();
        return;
      }

      if (!reminderReadyRef.current) {
        const granted = await requestReminderPermission();
        if (!granted) {
          setState((current) => ({
            ...current,
            settings: { ...current.settings, reminderEnabled: false },
          }));
          return;
        }
        reminderReadyRef.current = true;
      }

      const plan = state.studyPlans[state.activePackId] ?? createDefaultStudyPlan(state.activePackId);
      const dateKey = getStudyDateKey(new Date(), plan.dayBoundaryHour);
      const task = state.dailyTasks[state.activePackId]?.[dateKey];
      const completed = new Set(task?.completedWordIds ?? []);
      const reviewCount = task?.dueReviewIds.filter((id) => !completed.has(id)).length ?? 0;
      const newCount = task
        ? [...task.newWordIds, ...task.catchUpWordIds].filter((id) => !completed.has(id)).length
        : plan.dailyNewWordTarget;
      await scheduleDailyReminder(reminderHour, reminderMinute, reviewCount, newCount);
    };

    syncReminder().catch(() => undefined);
  }, [
    hydrated,
    state.settings.reminderEnabled,
    state.settings.reminderHour,
    state.settings.reminderMinute,
    state.activePackId,
    state.dailyTasks,
    state.studyPlans,
  ]);

  const deck = state.deck;
  const availablePacks = useMemo(
    () => [...builtInPacks, ...state.customPacks],
    [state.customPacks],
  );
  const activePack = useMemo(
    () => availablePacks.find((pack) => pack.id === state.activePackId) ?? availablePacks[0],
    [availablePacks, state.activePackId],
  );
  const deckById = useMemo(() => new Map(deck.map((entry) => [entry.id, entry])), [deck]);
  const favoriteIdSet = useMemo(() => new Set(state.favoriteIds), [state.favoriteIds]);
  const stats = useMemo(() => getStats(deck), [deck]);
  const dueDeck = useMemo(() => deck.filter((entry) => isDue(entry)), [deck]);
  const searchedDueDeck = useMemo(
    () => filterWords(dueDeck, state.searchQuery),
    [dueDeck, state.searchQuery],
  );

  const activeWordId = useMemo(() => chooseActiveWordId(searchedDueDeck), [searchedDueDeck]);
  const activeWord = useMemo(
    () => searchedDueDeck.find((entry) => entry.id === activeWordId) ?? searchedDueDeck[0],
    [activeWordId, searchedDueDeck],
  );

  const favorites = useMemo(
    () => deck.filter((entry) => favoriteIdSet.has(entry.id)),
    [deck, favoriteIdSet],
  );

  const wrongWords = useMemo(
    () =>
      deck
        .filter((entry) => entry.state.wrongCount > 0)
        .sort((a, b) => b.state.wrongCount - a.state.wrongCount),
    [deck],
  );

  const currentPlan = useMemo(
    () => state.studyPlans[state.activePackId] ?? createDefaultStudyPlan(state.activePackId),
    [state.activePackId, state.studyPlans],
  );
  const currentDateKey = useMemo(
    () => getStudyDateKey(new Date(), currentPlan.dayBoundaryHour),
    [currentPlan.dayBoundaryHour, scheduleTick],
  );
  const currentTask = state.dailyTasks[state.activePackId]?.[currentDateKey];
  const tomorrowReviewCount = useMemo(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tomorrowKey = getStudyDateKey(tomorrow, currentPlan.dayBoundaryHour);
    return deck.filter((entry) => {
      if (!isIntroduced(entry) || !entry.state.nextReviewAt) return false;
      return getStudyDateKey(new Date(entry.state.nextReviewAt), currentPlan.dayBoundaryHour) === tomorrowKey;
    }).length;
  }, [currentPlan.dayBoundaryHour, deck, scheduleTick]);

  useEffect(() => {
    if (!hydrated || currentTask) return;
    setState((current) => {
      const packId = current.activePackId;
      const plan = current.studyPlans[packId] ?? createDefaultStudyPlan(packId);
      const tasks = current.dailyTasks[packId] ?? {};
      const dateKey = getStudyDateKey(new Date(), plan.dayBoundaryHour);
      if (tasks[dateKey]) return current;
      return {
        ...current,
        studyPlans: { ...current.studyPlans, [packId]: plan },
        dailyTasks: {
          ...current.dailyTasks,
          [packId]: { ...tasks, [dateKey]: createDailyTask(current.deck, plan, tasks) },
        },
      };
    });
  }, [currentDateKey, currentTask, hydrated]);

  const taskQueue = useMemo(() => {
    if (!currentTask) return [];
    return remainingTaskIds(currentTask)
      .map((id) => deckById.get(id))
      .filter((entry): entry is DeckEntry => Boolean(entry));
  }, [currentTask, deckById]);
  const reviewQueue = useMemo(
    () => taskQueue.slice(0, currentPlan.batchSize),
    [currentPlan.batchSize, taskQueue],
  );
  const taskSummary = useMemo(() => {
    if (!currentTask) {
      return { total: 0, completed: 0, reviewTotal: 0, reviewCompleted: 0, newTotal: 0, newCompleted: 0, catchUpTotal: 0, catchUpCompleted: 0, advancedCompleted: 0 };
    }
    const completed = new Set(currentTask.completedWordIds);
    const count = (ids: string[]) => ids.filter((id) => completed.has(id)).length;
    const required = requiredTaskIds(currentTask);
    return {
      total: required.length,
      completed: count(required),
      reviewTotal: currentTask.dueReviewIds.length,
      reviewCompleted: count(currentTask.dueReviewIds),
      newTotal: currentTask.newWordIds.length,
      newCompleted: count(currentTask.newWordIds),
      catchUpTotal: currentTask.catchUpWordIds.length,
      catchUpCompleted: count(currentTask.catchUpWordIds),
      advancedCompleted: count(currentTask.advancedWordIds),
    };
  }, [currentTask]);

  const getWordById = (wordId: string) => deckById.get(wordId);

  const reviewWord = (wordId: string, rating: ReviewRating) => {
    setState((current) => {
      const index = current.deck.findIndex((entry) => entry.id === wordId);
      if (index < 0) {
        return current;
      }

      const nextDeck = current.deck.slice();
      nextDeck[index] = applyReview(current.deck[index], rating);

      return {
        ...current,
        deck: nextDeck,
        reviewLogs: [makeReviewLog(wordId, rating), ...current.reviewLogs],
      };
    });
  };

  const reviewTaskWord = (wordId: string, rating: ReviewRating) => {
    setState((current) => {
      const index = current.deck.findIndex((entry) => entry.id === wordId);
      if (index < 0) return current;
      const packId = current.activePackId;
      const plan = current.studyPlans[packId] ?? createDefaultStudyPlan(packId);
      const dateKey = getStudyDateKey(new Date(), plan.dayBoundaryHour);
      const tasks = current.dailyTasks[packId] ?? {};
      const task = tasks[dateKey];
      if (!task || !taskTypeForWord(task, wordId)) return current;
      const nextDeck = current.deck.slice();
      nextDeck[index] = applyReview(current.deck[index], rating);
      const completedTask = completeTaskWord(task, wordId);
      const nextTask = rating === 'again' && !completedTask.skippedRelearningIds.includes(wordId)
        ? { ...completedTask, skippedRelearningIds: [...completedTask.skippedRelearningIds, wordId] }
        : completedTask;
      return {
        ...current,
        deck: nextDeck,
        reviewLogs: [makeReviewLog(wordId, rating), ...current.reviewLogs],
        dailyTasks: {
          ...current.dailyTasks,
          [packId]: { ...tasks, [dateKey]: nextTask },
        },
      };
    });
  };

  const updateStudyPlan = (patch: Partial<StudyPlan>) => {
    setState((current) => {
      const packId = current.activePackId;
      const plan = current.studyPlans[packId] ?? createDefaultStudyPlan(packId);
      const nextPlan = { ...plan, ...patch, packId, id: plan.id };
      return {
        ...current,
        studyPlans: { ...current.studyPlans, [packId]: nextPlan },
        settings: { ...current.settings, reviewBatchSize: nextPlan.batchSize },
      };
    });
  };

  const startAdvancedLearning = () => {
    setState((current) => {
      const packId = current.activePackId;
      const plan = current.studyPlans[packId] ?? createDefaultStudyPlan(packId);
      const dateKey = getStudyDateKey(new Date(), plan.dayBoundaryHour);
      const tasks = current.dailyTasks[packId] ?? {};
      const task = tasks[dateKey];
      if (!task || task.status !== 'completed') return current;
      const advanced = addAdvancedWords(task, current.deck, plan, tasks);
      if (advanced.count === 0) return current;
      return {
        ...current,
        dailyTasks: { ...current.dailyTasks, [packId]: { ...tasks, [dateKey]: advanced.task } },
      };
    });
  };

  const toggleFavorite = (wordId: string) => {
    setState((current) => {
      const exists = current.favoriteIds.includes(wordId);
      return {
        ...current,
        favoriteIds: exists
          ? current.favoriteIds.filter((id) => id !== wordId)
          : [wordId, ...current.favoriteIds],
      };
    });
  };

  const updateSettings = (patch: Partial<AppSettings>) => {
    setState((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  };

  const setReminderEnabled = (enabled: boolean) => {
    updateSettings({ reminderEnabled: enabled });
  };

  const setReminderTime = (hour: number, minute: number) => {
    updateSettings({ reminderHour: hour, reminderMinute: minute });
  };

  const setSearchQuery = (searchQuery: string) => {
    setState((current) => ({
      ...current,
      searchQuery,
    }));
  };

  const speakWord = async (wordText: string) => {
    const text = wordText.trim();
    if (!text) return;
    await Speech.stop();
    Speech.speak(wordText, {
      language: 'en-US',
      rate: 0.86,
      pitch: 1,
      useApplicationAudioSession: false,
      onError: (error) => console.warn('Speech playback failed:', error),
    });
  };

  const resetAll = async () => {
    const fresh = createDefaultAppState();
    setState(fresh);
    await clearAppState();
    await saveAppState(fresh);
  };

  const switchPack = (packId: string) => {
    setState((current) => {
      if (packId === current.activePackId) {
        return current;
      }

      const packs = [...builtInPacks, ...current.customPacks];
      const pack = packs.find((item) => item.id === packId);
      if (!pack) {
        return current;
      }

      const currentProgress = deckProgressFromDeck(current.deck);
      const nextPackProgress = current.packProgress[packId] ?? [];
      const nextDeck = buildDeckFromWords(pack.words, nextPackProgress);
      const nextPlan = current.studyPlans[packId] ?? createDefaultStudyPlan(packId);
      const nextTasks = current.dailyTasks[packId] ?? {};
      const dateKey = getStudyDateKey(new Date(), nextPlan.dayBoundaryHour);
      return {
        ...current,
        activePackId: packId,
        deck: nextDeck,
        packProgress: {
          ...current.packProgress,
          [current.activePackId]: currentProgress,
        },
        studyPlans: { ...current.studyPlans, [packId]: nextPlan },
        dailyTasks: {
          ...current.dailyTasks,
          [packId]: nextTasks[dateKey]
            ? nextTasks
            : { ...nextTasks, [dateKey]: createDailyTask(nextDeck, nextPlan, nextTasks) },
        },
        searchQuery: '',
      };
    });
  };

  const importWordPack = (title: string, words: Word[]) => {
    const cleanWords = sanitizeWordList(words);
    if (cleanWords.length === 0) {
      return 0;
    }

    const packId = makeImportedPackId(title);
    const packWords = cleanWords.map((word, index) => ({
      ...word,
      id: word.id.startsWith(`${packId}-`)
        ? word.id
        : `${packId}-${String(index + 1).padStart(4, '0')}-${word.id}`,
    }));

    setState((current) => {
      const currentProgress = deckProgressFromDeck(current.deck);
      const nextDeck = createInitialDeck(packWords);
      const nextPlan = createDefaultStudyPlan(packId);
      const dateKey = getStudyDateKey(new Date(), nextPlan.dayBoundaryHour);

      return {
        ...current,
        activePackId: packId,
        deck: nextDeck,
        customPacks: [
          ...current.customPacks,
          {
            id: packId,
            title,
            description: `导入词库，${packWords.length} 词`,
            words: packWords,
          },
        ],
        packProgress: {
          ...current.packProgress,
          [current.activePackId]: currentProgress,
          [packId]: [],
        },
        studyPlans: { ...current.studyPlans, [packId]: nextPlan },
        dailyTasks: {
          ...current.dailyTasks,
          [packId]: { [dateKey]: createDailyTask(nextDeck, nextPlan, {}) },
        },
        searchQuery: '',
      };
    });

    return cleanWords.length;
  };

  const upsertReadingWord = (input: ReadingWordInput) => {
    const normalized = input.term.trim().toLowerCase();
    const wordId = `reading-${normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    setState((current) => {
      const existingPack = current.customPacks.find((pack) => pack.id === READING_PACK_ID);
      const existingWord = existingPack?.words.find(
        (word) => word.term.trim().toLowerCase() === normalized,
      );
      const nextWord: Word = existingWord
        ? {
            ...existingWord,
            phonetic: existingWord.phonetic || input.phonetic || '',
            meaning: existingWord.meaning || input.meaning || '',
            tags: [...new Set([...(existingWord.tags ?? []), ...(input.tags ?? [])])],
            example: existingWord.example || input.sentence,
            sourceBook: existingWord.sourceBook || input.sourceBook,
            rawText: input.sentence,
          }
        : {
            id: wordId,
            term: input.term,
            phonetic: input.phonetic || '',
            meaning: input.meaning || '',
            tags: input.tags,
            example: input.sentence,
            exampleMeaning: '',
            sourceBook: input.sourceBook,
            rawText: input.sentence,
          };
      const words = existingPack
        ? existingPack.words.some((word) => word.id === nextWord.id)
          ? existingPack.words.map((word) => (word.id === nextWord.id ? nextWord : word))
          : [...existingPack.words, nextWord]
        : [nextWord];
      const customPacks = existingPack
        ? current.customPacks.map((pack) =>
            pack.id === READING_PACK_ID
              ? { ...pack, words, description: `阅读中积累的生词，${words.length} 词` }
              : pack,
          )
        : [
            ...current.customPacks,
            {
              id: READING_PACK_ID,
              title: '阅读生词',
              description: `阅读中积累的生词，${words.length} 词`,
              words,
            },
          ];
      const plan = current.studyPlans[READING_PACK_ID] ?? createDefaultStudyPlan(READING_PACK_ID);
      const nextState = {
        ...current,
        customPacks,
        studyPlans: { ...current.studyPlans, [READING_PACK_ID]: plan },
        packProgress: { ...current.packProgress, [READING_PACK_ID]: current.packProgress[READING_PACK_ID] ?? [] },
      };
      if (current.activePackId !== READING_PACK_ID) return nextState;
      const progress = deckProgressFromDeck(current.deck);
      return { ...nextState, deck: buildDeckFromWords(words, progress) };
    });
    return wordId;
  };

  return {
    hydrated,
    state,
    deck,
    availablePacks,
    activePack,
    currentPlan,
    currentTask,
    currentDateKey,
    dueDeck,
    taskQueue,
    taskSummary,
    tomorrowReviewCount,
    reviewQueue,
    activeWord,
    favorites,
    wrongWords,
    stats,
    getWordById,
    reviewWord,
    reviewTaskWord,
    updateStudyPlan,
    startAdvancedLearning,
    getTaskWordType: (wordId: string) => currentTask ? taskTypeForWord(currentTask, wordId) : undefined,
    estimatedCompletionDate: estimatedCompletionDate(
      deck.filter((entry) => !isIntroduced(entry)).length,
      currentPlan,
    ),
    toggleFavorite,
    updateSettings,
    setReminderEnabled,
    setReminderTime,
    setSearchQuery,
    speakWord,
    importWordPack,
    upsertReadingWord,
    switchPack,
    resetAll,
    isFavorite: (wordId: string) => favoriteIdSet.has(wordId),
  };
}

export type AppStateApi = ReturnType<typeof useAppState>;
