import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AiReadingConfig } from '../../domain/aiReading';

const STORAGE_KEY = '@reading/ai-config-v1';

export const DEFAULT_AI_READING_CONFIG: AiReadingConfig = {
  enabled: false,
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4.1-mini',
  learnerLevel: 'intermediate',
};

// 内存缓存：每次点按 AI 按钮（LookupSheet/RecallCoachModal）都会读配置，避免反复读 AsyncStorage。
let cachedConfig: AiReadingConfig | null = null;

export async function loadAiReadingConfig(): Promise<AiReadingConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI_READING_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AiReadingConfig>;
    cachedConfig = {
      ...DEFAULT_AI_READING_CONFIG,
      ...parsed,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    };
    return cachedConfig;
  } catch {
    return DEFAULT_AI_READING_CONFIG;
  }
}

export async function saveAiReadingConfig(config: AiReadingConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  cachedConfig = config;
}

export function clearAiReadingConfigCache(): void {
  cachedConfig = null;
}

/** 清除持久化的 AI 配置（含 apiKey），供"重置全部"调用。 */
export async function resetAiReadingConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  clearAiReadingConfigCache();
}

export function isAiConfigured(config: AiReadingConfig): boolean {
  return config.enabled && Boolean(config.apiUrl.trim() && config.apiKey.trim() && config.model.trim());
}
