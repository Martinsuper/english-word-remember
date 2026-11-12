import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { RecallEvaluation, RecallExercise } from '../../domain/aiReading';
import { isAiConfigured, loadAiReadingConfig } from '../../infrastructure/ai/aiReadingConfig';
import {
  createLocalRecallExercise,
  createRecallExercise,
  evaluateRecall,
} from '../../infrastructure/ai/aiReadingService';
import { colors, radius, spacing, pressedOpacity } from '../../../theme';

type Props = {
  visible: boolean;
  mode: 'paragraph' | 'chapter';
  passage: string;
  onClose: () => void;
};

export function RecallCoachModal({ visible, mode, passage, onClose }: Props) {
  const [exercise, setExercise] = useState<RecallExercise | null>(null);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<RecallEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    if (!visible || !passage.trim()) return;
    // 中途关闭/切换时中止在途请求，避免无意义的 AI 计费调用。
    const controller = new AbortController();
    let active = true;
    setAnswer('');
    setEvaluation(null);
    setShowHint(false);
    setShowSource(false);
    setLoading(true);
    (async () => {
      const config = await loadAiReadingConfig();
      const configured = isAiConfigured(config);
      if (active) setAiEnabled(configured);
      const next = configured
        ? await createRecallExercise(config, passage, controller.signal)
        : createLocalRecallExercise(passage);
      if (active) setExercise(next);
    })().catch((error) => {
      if (!active || controller.signal.aborted) return;
      setAiEnabled(false);
      setExercise(createLocalRecallExercise(passage));
      Alert.alert('已使用离线回忆模式', error instanceof Error ? error.message : 'AI 暂时不可用');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [visible, passage, mode]);

  const submit = async () => {
    if (!exercise || !answer.trim() || loading) return;
    const config = await loadAiReadingConfig();
    if (!isAiConfigured(config)) {
      setShowSource(true);
      setEvaluation({
        verdict: 'partial',
        coverage: 0,
        coveredPoints: [],
        missingPoints: [],
        misconceptions: [],
        feedback: '当前为离线模式，请对照原文检查是否包含主要对象、作者观点以及因果或转折关系。配置 AI 后可获得语义评价。',
      });
      return;
    }
    setLoading(true);
    try {
      setEvaluation(await evaluateRecall(config, passage, exercise, answer.trim()));
    } catch (error) {
      Alert.alert('评价失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const verdictLabel = evaluation?.verdict === 'correct'
    ? '理解准确'
    : evaluation?.verdict === 'incorrect'
      ? '需要重新理解'
      : '基本理解，仍可补充';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{mode === 'paragraph' ? 'PARAGRAPH RECALL' : 'CHAPTER RETELLING'}</Text>
            <Text style={styles.title}>{mode === 'paragraph' ? '段落回忆' : '章节复述'}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>完成</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.guide}>先不要返回原文。尝试从记忆中提取内容，比再次阅读更能形成长期记忆。</Text>
          {loading && !exercise ? <ActivityIndicator size="large" color={colors.accent} /> : null}
          {exercise ? (
            <>
              <View style={styles.questionCard}>
                <Text style={styles.questionLabel}>{aiEnabled ? 'AI 理解问题' : '离线回忆问题'}</Text>
                <Text style={styles.question}>{mode === 'chapter' ? `读完这一章后：${exercise.question}` : exercise.question}</Text>
              </View>
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                multiline
                placeholder="用中文或英文写下你的理解…"
                placeholderTextColor="#647067"
                style={styles.answerInput}
                editable={!evaluation}
              />
              {!evaluation ? (
                <View style={styles.actionRow}>
                  <Pressable onPress={() => setShowHint((value) => !value)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryText}>{showHint ? '收起提示' : '给我一点提示'}</Text>
                  </Pressable>
                  <Pressable onPress={submit} disabled={!answer.trim() || loading} style={[styles.primaryButton, (!answer.trim() || loading) && styles.disabled]}>
                    {loading ? <ActivityIndicator size="small" color={colors.accentInk} /> : <Text style={styles.primaryText}>提交回忆</Text>}
                  </Pressable>
                </View>
              ) : null}
              {showHint && !evaluation ? <Text style={styles.hint}>提示：{exercise.hint}</Text> : null}

              {evaluation ? (
                <View style={styles.evaluationCard}>
                  <Text style={styles.evaluationTitle}>{verdictLabel}</Text>
                  {aiEnabled ? <Text style={styles.coverage}>要点覆盖 {Math.round(evaluation.coverage * 100)}%</Text> : null}
                  <Text style={styles.feedback}>{evaluation.feedback}</Text>
                  {evaluation.missingPoints.length > 0 ? (
                    <View><Text style={styles.listTitle}>可以补充</Text>{evaluation.missingPoints.map((point) => <Text key={point} style={styles.listItem}>• {point}</Text>)}</View>
                  ) : null}
                  {evaluation.misconceptions.length > 0 ? (
                    <View><Text style={styles.warningTitle}>需要纠正</Text>{evaluation.misconceptions.map((point) => <Text key={point} style={styles.listItem}>• {point}</Text>)}</View>
                  ) : null}
                  <Pressable onPress={() => setShowSource((value) => !value)} style={styles.sourceButton}>
                    <Text style={styles.sourceButtonText}>{showSource ? '收起原文' : '对照原文'}</Text>
                  </Pressable>
                </View>
              ) : null}
              {showSource ? <View style={styles.sourceCard}><Text style={styles.sourceText}>{passage}</Text></View> : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// 眉题：小号大写间距字。
const typographyEyebrow = { fontSize: 10, fontWeight: '600' as const, letterSpacing: 1.5 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  eyebrow: { ...typographyEyebrow, color: colors.accent },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginTop: 3 },
  closeButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.lg, backgroundColor: colors.accentMuted },
  closeText: { color: colors.accent, fontWeight: '600' },
  content: { padding: spacing.xl, paddingBottom: 50, gap: 14 },
  guide: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  questionCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: 7 },
  questionLabel: { color: colors.accent, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  question: { color: colors.textPrimary, fontSize: 18, lineHeight: 27, fontWeight: '600' },
  answerInput: { minHeight: 140, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, color: colors.textPrimary, padding: 15, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.textPrimary, fontWeight: '600' },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.accentInk, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  hint: { color: colors.accent, backgroundColor: colors.accentMuted, borderRadius: radius.md, padding: spacing.md, fontSize: 13, lineHeight: 19 },
  evaluationCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 10 },
  evaluationTitle: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  coverage: { color: colors.textSecondary, fontSize: 12 },
  feedback: { color: colors.textPrimary, fontSize: 15, lineHeight: 23 },
  listTitle: { color: colors.accent, fontSize: 12, fontWeight: '600', marginBottom: 5 },
  warningTitle: { color: colors.dangerSoft, fontSize: 12, fontWeight: '600', marginBottom: 5 },
  listItem: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  sourceButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 11, backgroundColor: colors.accentMuted, borderRadius: radius.md },
  sourceButtonText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  sourceCard: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: 15 },
  sourceText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
});
