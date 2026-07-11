export type ReviewRating = 'again' | 'hard' | 'good';

export type Word = {
  id: string;
  term: string;
  phonetic: string;
  meaning: string;
  example: string;
  exampleMeaning: string;
  sourceBook?: string;
  sourcePage?: number;
  rawText?: string;
};

export type ReviewState = {
  introducedAt?: string;
  learningStep: number;
  easeFactor: number;
  intervalDays: number;
  repetition: number;
  nextReviewAt?: string;
  lastReviewedAt?: string;
  correctCount: number;
  wrongCount: number;
};

export type StudyPlan = {
  id: string;
  packId: string;
  mode: 'deadline' | 'daily_words' | 'daily_time';
  startDate: string;
  targetDate?: string;
  dailyNewWordTarget: number;
  dailyMinutesTarget?: number;
  studyWeekdays: number[];
  batchSize: number;
  catchUpStrategy: 'smooth' | 'shift' | 'next_day';
  dailyCatchUpCapRatio: number;
  dayBoundaryHour: number;
  status: 'active' | 'paused' | 'completed';
};

export type DailyTask = {
  dateKey: string;
  planId: string;
  dueReviewIds: string[];
  newWordIds: string[];
  catchUpWordIds: string[];
  advancedWordIds: string[];
  advancedTargetDateKey?: string;
  completedWordIds: string[];
  skippedRelearningIds: string[];
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt?: string;
};

export type TaskWordType = 'review' | 'new' | 'catch_up' | 'advanced';

export type DeckEntry = Word & {
  state: ReviewState;
};

export type WordPack = {
  id: string;
  title: string;
  description: string;
  words: Word[];
};

export type DeckProgressEntry = {
  id: string;
  state: ReviewState;
};
