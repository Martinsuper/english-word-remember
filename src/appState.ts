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

// reviewLogs 目前无 UI 消费，仅作为学习记录持久化；设上限防止存储体积无界膨胀。
export const MAX_REVIEW_LOGS = 500;

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
