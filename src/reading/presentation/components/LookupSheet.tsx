import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReadingLocator } from '../../domain/models';
import { normalizeWord } from '../../domain/wordSelection';
import { addReadingWord } from '../../application/addReadingVocabulary';
import type { AppStateApi } from '../../../hooks/useAppState';
import { lookupLocalWord } from '../../domain/localDictionary';
import { lookupFreeDictionary, OnlineDictionaryEntry } from '../../infrastructure/dictionary/freeDictionaryProvider';
import { lookupExamDictionary } from '../../infrastructure/dictionary/examDictionary';
import { lookupOnlineTranslation, OnlineTranslationEntry } from '../../infrastructure/dictionary/onlineTranslationProvider';
import { lookupEcdict, EcdictEntry } from '../../infrastructure/dictionary/ecdictProvider';
import type { ContextWordAnalysis, SentenceAnalysis } from '../../domain/aiReading';
import { loadAiReadingConfig, isAiConfigured } from '../../infrastructure/ai/aiReadingConfig';
import { colors, radius, spacing, pressedOpacity } from '../../../theme';
import {
  analyzeSentence,
  analyzeWordInContext,
  createLocalSentenceAnalysis,
} from '../../infrastructure/ai/aiReadingService';

export type LookupData = {
  word: string;
  sentence: string;
  bookId: string;
  chapterId: string;
  locator: ReadingLocator;
};

type LookupSheetProps = {
  visible: boolean;
  data: LookupData | null;
  app: AppStateApi;
  onClose: () => void;
  bookTitle: string;
};

export function LookupSheet({ visible, data, app, onClose, bookTitle }: LookupSheetProps) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [onlineEntry, setOnlineEntry] = useState<OnlineDictionaryEntry | null>(null);
  const [onlineTranslation, setOnlineTranslation] = useState<OnlineTranslationEntry | null>(null);
  const [ecdictEntry, setEcdictEntry] = useState<EcdictEntry | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState<'word' | 'sentence' | null>(null);
  const [wordAnalysis, setWordAnalysis] = useState<ContextWordAnalysis | null>(null);
  const [sentenceAnalysis, setSentenceAnalysis] = useState<SentenceAnalysis | null>(null);
  // AI 请求归属校验：换词后旧请求的结果一律丢弃，避免旧词解析串到新词下。
  const aiRequestSeqRef = useRef(0);

  const queryWord = data?.word ?? '';
  const normalized = normalizeWord(queryWord);
  const dictionaryMatch = useMemo(
    () => lookupLocalWord(app.availablePacks, queryWord),
    [app.availablePacks, queryWord],
  );
  const localWord = dictionaryMatch?.word;
  const examEntry = useMemo(() => lookupExamDictionary(queryWord), [queryWord]);
  const tags = examEntry?.tags ?? localWord?.tags ?? ecdictEntry?.tags ?? [];
  const resolvedPhonetic = localWord?.phonetic || examEntry?.phonetic || ecdictEntry?.phonetic || onlineEntry?.phonetic || '';
  const resolvedMeaning = localWord?.meaning || examEntry?.meaning || ecdictEntry?.meaning || onlineTranslation?.meaning || onlineEntry?.meaning || '';

  useEffect(() => {
    setOnlineEntry(null);
    setOnlineTranslation(null);
    setEcdictEntry(null);
    if (!visible || localWord || examEntry) {
      setOnlineLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setOnlineLoading(true);
    (async () => {
      const offline = await lookupEcdict(normalized);
      if (!active) return;
      setEcdictEntry(offline);
      if (offline) return;
      const [translation, dictionary] = await Promise.all([
        lookupOnlineTranslation(normalized, controller.signal),
        lookupFreeDictionary(normalized, controller.signal),
      ]);
      if (!active) return;
      setOnlineTranslation(translation);
      setOnlineEntry(dictionary);
    })().finally(() => {
      if (active) setOnlineLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [normalized, visible, Boolean(localWord), Boolean(examEntry)]);

  useEffect(() => {
    if (!visible) return;
    aiRequestSeqRef.current += 1;
    setWordAnalysis(null);
    setSentenceAnalysis(null);
    setAiLoading(null);
  }, [visible, data?.sentence, data?.word]);

  if (!data) return null;

  const handleAdd = async () => {
    if (adding) return;
    // 在线释义还在查询中时不要把空释义写入生词库。
    if (onlineLoading && !resolvedMeaning) {
      setResultMessage('释义查询中，请稍候再试');
      return;
    }
    setAdding(true);

    try {
      const wordId = app.upsertReadingWord({
        term: data.word,
        phonetic: resolvedPhonetic,
        meaning: resolvedMeaning,
        tags,
        sentence: data.sentence,
        sourceBook: bookTitle,
      });
      const result = await addReadingWord({
        wordId,
        surfaceForm: data.word,
        sentence: data.sentence,
        bookId: data.bookId,
        chapterId: data.chapterId,
        locator: data.locator,
      });

      switch (result.status) {
        case 'created':
          setResultMessage('已加入阅读生词');
          setAdded(true);
          break;
        case 'context_added':
          setResultMessage('已补充语境');
          setAdded(true);
          break;
        case 'already_exists':
          setResultMessage('此语境已存在');
          setAdded(true);
          break;
      }
    } catch (error) {
      console.error('Failed to add word:', error);
      setResultMessage('加入失败，请重试');
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setAdded(false);
    setResultMessage('');
    onClose();
  };

  const handleAiWord = async () => {
    if (!data || aiLoading) return;
    const config = await loadAiReadingConfig();
    if (!isAiConfigured(config)) {
      Alert.alert('需要配置 AI', '请前往“我的”页面的“AI 阅读教练”填写接口、密钥和模型。');
      return;
    }
    const seq = ++aiRequestSeqRef.current;
    setAiLoading('word');
    try {
      const analysis = await analyzeWordInContext(config, data.word, data.sentence);
      if (seq !== aiRequestSeqRef.current) return;
      setWordAnalysis(analysis);
    } catch (error) {
      if (seq !== aiRequestSeqRef.current) return;
      Alert.alert('AI 解析失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      if (seq === aiRequestSeqRef.current) setAiLoading(null);
    }
  };

  const handleSentenceAnalysis = async () => {
    if (!data || aiLoading) return;
    const config = await loadAiReadingConfig();
    const seq = ++aiRequestSeqRef.current;
    setAiLoading('sentence');
    try {
      const analysis = isAiConfigured(config)
        ? await analyzeSentence(config, data.sentence)
        : createLocalSentenceAnalysis(data.sentence);
      if (seq !== aiRequestSeqRef.current) return;
      setSentenceAnalysis(analysis);
    } catch (error) {
      if (seq !== aiRequestSeqRef.current) return;
      setSentenceAnalysis(createLocalSentenceAnalysis(data.sentence));
      Alert.alert('已切换到离线拆分', error instanceof Error ? error.message : 'AI 暂时不可用');
    } finally {
      if (seq === aiRequestSeqRef.current) setAiLoading(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View />
      </Pressable>
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.wordRow}>
          <Text style={styles.word}>{data.word}</Text>
          <Text style={styles.normalized}>({normalized})</Text>
        </View>

        <Pressable onPress={() => app.speakWord(data.word)} style={({ pressed }) => [styles.speakButton, pressed && { opacity: pressedOpacity }]}>
          <Ionicons name="volume-medium-outline" size={15} color={colors.accent} />
          <Text style={styles.speakButtonText}>美式发音</Text>
        </Pressable>

        {localWord || examEntry || ecdictEntry ? (
          <View style={styles.localInfo}>
            <Text style={styles.onlineLabel}>{ecdictEntry && !localWord && !examEntry ? 'ECDICT 完整离线词典' : '离线英汉词典'}</Text>
            {normalizeWord(localWord?.term ?? examEntry?.term ?? ecdictEntry?.term ?? '') !== normalized ? (
              <Text style={styles.matchedTerm}>原形：{localWord?.term ?? examEntry?.term ?? ecdictEntry?.term}</Text>
            ) : null}
            {tags.length > 0 ? (
              <View style={styles.tagRow}>
                {tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
              </View>
            ) : null}
            {resolvedPhonetic ? <Text style={styles.phonetic}>/{resolvedPhonetic.replace(/^\/|\/$/g, '')}/</Text> : null}
            <Text style={styles.meaning}>{resolvedMeaning}</Text>
            {ecdictEntry?.englishDefinition ? <Text style={styles.englishMeaning}>{ecdictEntry.englishDefinition}</Text> : null}
          </View>
        ) : onlineTranslation || onlineEntry ? (
          <View style={styles.localInfo}>
            <Text style={styles.onlineLabel}>{onlineTranslation ? '在线英汉翻译' : '在线英英释义'}</Text>
            {onlineEntry?.phonetic ? <Text style={styles.phonetic}>{onlineEntry.phonetic}</Text> : null}
            <Text style={styles.meaning}>{onlineTranslation?.meaning ?? onlineEntry?.meaning}</Text>
            {onlineTranslation && onlineEntry ? <Text style={styles.englishMeaning}>{onlineEntry.meaning}</Text> : null}
          </View>
        ) : (
          <View style={styles.localInfo}>
            <Text style={styles.noEntry}>{onlineLoading ? '正在查询释义…' : '暂未找到释义'}</Text>
          </View>
        )}

        <View style={styles.sentenceBox}>
          <Text style={styles.sentenceLabel}>原文语境</Text>
          <Text style={styles.sentence}>{data.sentence}</Text>
        </View>

        <View style={styles.aiActions}>
          <Pressable onPress={handleAiWord} disabled={Boolean(aiLoading)} style={({ pressed }) => [styles.aiButton, pressed && { opacity: pressedOpacity }]}>
            {aiLoading === 'word' ? <ActivityIndicator size="small" color={colors.accent} /> : (
              <>
                <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
                <Text style={styles.aiButtonText}>AI 语境解析</Text>
              </>
            )}
          </Pressable>
          <Pressable onPress={handleSentenceAnalysis} disabled={Boolean(aiLoading)} style={({ pressed }) => [styles.aiButton, pressed && { opacity: pressedOpacity }]}>
            {aiLoading === 'sentence' ? <ActivityIndicator size="small" color={colors.accent} /> : (
              <>
                <Ionicons name="document-text-outline" size={14} color={colors.accent} />
                <Text style={styles.aiButtonText}>拆解这句话</Text>
              </>
            )}
          </Pressable>
        </View>

        {wordAnalysis ? (
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>当前语境</Text>
            <Text style={styles.analysisPrimary}>{wordAnalysis.meaningInContext}</Text>
            <Text style={styles.analysisLine}>词块：{wordAnalysis.chunk}</Text>
            <Text style={styles.analysisLine}>作用：{wordAnalysis.sentenceRole}</Text>
            <Text style={styles.analysisEnglish}>{wordAnalysis.simpleEnglish}</Text>
            {wordAnalysis.contrast ? <Text style={styles.analysisHint}>{wordAnalysis.contrast}</Text> : null}
          </View>
        ) : null}

        {sentenceAnalysis ? (
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>句子拆解</Text>
            {sentenceAnalysis.chunks.map((chunk, index) => (
              <View key={`${chunk.text}-${index}`} style={styles.chunkRow}>
                <Text style={styles.chunkText}>{chunk.text}</Text>
                <Text style={styles.chunkRole}>{chunk.role}</Text>
              </View>
            ))}
            <Text style={styles.analysisLine}>主干：{sentenceAnalysis.core}</Text>
            <Text style={styles.analysisLine}>逻辑：{sentenceAnalysis.logic}</Text>
            <Text style={styles.analysisPrimary}>{sentenceAnalysis.translation}</Text>
            <Text style={styles.analysisQuestion}>理解检查：{sentenceAnalysis.checkQuestion}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={handleClose}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>关闭</Text>
          </Pressable>

          {added ? (
            <View style={styles.addedBadge}>
              <Text style={styles.addedText}>{resultMessage}</Text>
            </View>
          ) : (
            <Pressable
              onPress={handleAdd}
              disabled={adding}
              style={({ pressed }) => [
                styles.addButton,
                adding && styles.addButtonDisabled,
                pressed && styles.addButtonPressed,
              ]}
            >
              {adding ? (
                <ActivityIndicator size="small" color={colors.accentInk} />
              ) : (
                <Text style={styles.addButtonText}>加入阅读生词</Text>
              )}
            </Pressable>
          )}
        </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '86%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  word: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  normalized: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  speakButton: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, marginBottom: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.accentMuted },
  speakButtonText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  localInfo: {
    marginBottom: spacing.md,
  },
  phonetic: {
    color: colors.accent,
    fontSize: 14,
    marginBottom: 4,
  },
  matchedTerm: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  onlineLabel: { color: colors.textSecondary, fontSize: 11, marginBottom: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  tag: { color: colors.accentInk, backgroundColor: colors.accentSoft, borderRadius: radius.sm - 2, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: '600' },
  meaning: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  englishMeaning: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.sm, fontStyle: 'italic' },
  noEntry: {
    color: colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  sentenceBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  aiActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  aiButton: { flex: 1, minHeight: 42, flexDirection: 'row', gap: 6, paddingHorizontal: 8, borderRadius: radius.md, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  aiButtonText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  analysisCard: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: 14, gap: 7 },
  analysisTitle: { color: colors.accent, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  analysisPrimary: { color: colors.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  analysisLine: { color: colors.textPrimary, fontSize: 13, lineHeight: 19, opacity: 0.88 },
  analysisEnglish: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  analysisHint: { color: colors.accent, fontSize: 12, lineHeight: 18, opacity: 0.85 },
  chunkRow: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: 9, marginBottom: 2 },
  chunkText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  chunkRole: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  analysisQuestion: { color: colors.accent, fontSize: 13, lineHeight: 19, marginTop: 3, opacity: 0.85 },
  sentenceLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sentence: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  addButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  addButtonDisabled: { opacity: 0.5 },
  addButtonPressed: { opacity: pressedOpacity },
  addButtonText: {
    color: colors.accentInk,
    fontWeight: '700',
    fontSize: 14,
  },
  addedBadge: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  addedText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
});
