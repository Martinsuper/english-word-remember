export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced';

export type AiReadingConfig = {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  model: string;
  learnerLevel: LearnerLevel;
};

export type ContextWordAnalysis = {
  meaningInContext: string;
  chunk: string;
  simpleEnglish: string;
  sentenceRole: string;
  contrast: string;
};

export type SentenceAnalysis = {
  chunks: Array<{ text: string; role: string }>;
  core: string;
  logic: string;
  translation: string;
  checkQuestion: string;
  checkAnswer: string;
};

export type RecallExercise = {
  question: string;
  expectedPoints: string[];
  hint: string;
};

export type RecallEvaluation = {
  verdict: 'correct' | 'partial' | 'incorrect';
  coverage: number;
  coveredPoints: string[];
  missingPoints: string[];
  misconceptions: string[];
  feedback: string;
};
