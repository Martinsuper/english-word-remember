import type {
  AiReadingConfig,
  ContextWordAnalysis,
  RecallEvaluation,
  RecallExercise,
  SentenceAnalysis,
} from '../../domain/aiReading';

type JsonRecord = Record<string, unknown>;

const SYSTEM_PROMPT = `你是一名严谨的英语阅读教练。只依据用户提供的原文回答，不补充文章未表达的事实。
解释面向中国英语学习者，简洁、具体，优先讲当前语境、词块、句子主干和逻辑关系。
必须只返回有效 JSON，不要使用 Markdown 代码块。`;

async function requestJson<T>(
  config: AiReadingConfig,
  task: string,
  input: JsonRecord,
  validate: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const abortFromSignal = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abortFromSignal);
  }
  try {
    const response = await fetch(config.apiUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: config.model.trim(),
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({ task, learnerLevel: config.learnerLevel, ...input }),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`AI 服务返回 ${response.status}${detail ? `：${detail.slice(0, 120)}` : ''}`);
    }
    const payload = await response.json() as any;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('AI 服务没有返回可用内容');
    const parsed = JSON.parse(content) as unknown;
    if (!validate(parsed)) throw new Error('AI 返回的数据格式不完整');
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(signal?.aborted ? 'AI 请求已取消' : 'AI 请求超时，请检查网络后重试');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', abortFromSignal);
  }
}

export function analyzeWordInContext(
  config: AiReadingConfig,
  word: string,
  sentence: string,
  signal?: AbortSignal,
): Promise<ContextWordAnalysis> {
  return requestJson(
    config,
    '分析目标词在当前句中的含义。返回 meaningInContext、chunk、simpleEnglish、sentenceRole、contrast 五个字符串字段。chunk 必须来自原句；没有明显词块时返回目标词。',
    { word, sentence: sentence.slice(0, 1200) },
    isWordAnalysis,
    signal,
  );
}

export function analyzeSentence(
  config: AiReadingConfig,
  sentence: string,
  signal?: AbortSignal,
): Promise<SentenceAnalysis> {
  return requestJson(
    config,
    '渐进拆解句子。返回 chunks（text/role 数组）、core、logic、translation、checkQuestion、checkAnswer。chunks 中的 text 必须是原句连续片段。',
    { sentence: sentence.slice(0, 1600) },
    isSentenceAnalysis,
    signal,
  );
}

export function createRecallExercise(
  config: AiReadingConfig,
  passage: string,
  signal?: AbortSignal,
): Promise<RecallExercise> {
  return requestJson(
    config,
    '根据段落生成一道需要主动回忆的中文问题。返回 question、expectedPoints（1到4个字符串）、hint。问题优先考查主旨、因果或对比，不考琐碎事实。',
    { passage: passage.slice(0, 5000) },
    isRecallExercise,
    signal,
  );
}

export function evaluateRecall(
  config: AiReadingConfig,
  passage: string,
  exercise: RecallExercise,
  answer: string,
  signal?: AbortSignal,
): Promise<RecallEvaluation> {
  return requestJson(
    config,
    '评价学习者回答。允许中英文和同义改写。返回 verdict(correct/partial/incorrect)、coverage(0到1)、coveredPoints、missingPoints、misconceptions、feedback。重点识别因果方向、程度和作者观点错误。',
    { passage: passage.slice(0, 5000), exercise, answer: answer.slice(0, 2000) },
    isRecallEvaluation,
    signal,
  );
}

export function createLocalSentenceAnalysis(sentence: string): SentenceAnalysis {
  const clean = sentence.trim();
  const parts = clean
    .split(/(?<=[,;:])\s+|\s+(?=(?:but|and|because|although|while|whereas|which|that)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    chunks: (parts.length > 1 ? parts : [clean]).map((text, index) => ({
      text,
      role: index === 0 ? '先识别这一意群的核心动作' : '再判断它与前文的逻辑关系',
    })),
    core: '离线模式暂不判断完整语法主干，请先找出句中的主语和主要动词。',
    logic: '注意 but、although、because、which、that 等连接词所表达的关系。',
    translation: '配置 AI 后可生成结合当前语境的自然翻译。',
    checkQuestion: '不看原句，你能用自己的话说出这句话的主要意思吗？',
    checkAnswer: '重新查看原句，核对主语、主要动作以及转折或因果关系。',
  };
}

export function createLocalRecallExercise(passage: string): RecallExercise {
  const firstSentence = passage.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  return {
    question: '请暂时不看原文，用一句话概括这一段主要讲了什么？',
    expectedPoints: firstSentence ? [firstSentence] : [],
    hint: '想一想：这段在讲什么对象？作者对它提出了什么观点？',
  };
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isWordAnalysis(value: unknown): value is ContextWordAnalysis {
  const v = value as ContextWordAnalysis;
  return Boolean(v && typeof v.meaningInContext === 'string' && typeof v.chunk === 'string' &&
    typeof v.simpleEnglish === 'string' && typeof v.sentenceRole === 'string' && typeof v.contrast === 'string');
}

function isSentenceAnalysis(value: unknown): value is SentenceAnalysis {
  const v = value as SentenceAnalysis;
  return Boolean(v && Array.isArray(v.chunks) && v.chunks.every((c) => c && typeof c.text === 'string' && typeof c.role === 'string') &&
    typeof v.core === 'string' && typeof v.logic === 'string' && typeof v.translation === 'string' &&
    typeof v.checkQuestion === 'string' && typeof v.checkAnswer === 'string');
}

function isRecallExercise(value: unknown): value is RecallExercise {
  const v = value as RecallExercise;
  return Boolean(v && typeof v.question === 'string' && strings(v.expectedPoints) && typeof v.hint === 'string');
}

function isRecallEvaluation(value: unknown): value is RecallEvaluation {
  const v = value as RecallEvaluation;
  return Boolean(v && ['correct', 'partial', 'incorrect'].includes(v.verdict) &&
    typeof v.coverage === 'number' && v.coverage >= 0 && v.coverage <= 1 &&
    strings(v.coveredPoints) && strings(v.missingPoints) && strings(v.misconceptions) && typeof v.feedback === 'string');
}
