import { DailyTask, DeckEntry, DeckProgressEntry, StudyPlan, WordPack } from './types';

export type AppSettings = {
  reviewBatchSize: number;
  cardFrontLanguage: 'english' | 'chinese';
  showPhonetic: boolean;
  showExample: boolean;
  showExampleMeaning: boolean;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
};

export type ReviewLogEntry = {
  id: string;
  wordId: string;
  rating: 'again' | 'hard' | 'good';
  reviewedAt: string;
};

export type AppState = {
  deck: DeckEntry[];
  activePackId: string;
  customPacks: WordPack[];
  packProgress: Record<string, DeckProgressEntry[]>;
  studyPlans: Record<string, StudyPlan>;
  dailyTasks: Record<string, Record<string, DailyTask>>;
  favoriteIds: string[];
  reviewLogs: ReviewLogEntry[];
  settings: AppSettings;
  searchQuery: string;
};

export const defaultSettings: AppSettings = {
  reviewBatchSize: 10,
  cardFrontLanguage: 'english',
  showPhonetic: true,
  showExample: true,
  showExampleMeaning: true,
  reminderEnabled: false,
  reminderHour: 20,
  reminderMinute: 0,
};
