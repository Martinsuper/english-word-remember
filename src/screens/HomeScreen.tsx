import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WordRow } from '../components/WordRow';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';
import { AppStateApi } from '../hooks/useAppState';
import { colors, pressedOpacity, radius, spacing, typography } from '../theme';

export function HomeScreen({
  app,
  onOpenStudy,
  onOpenWrong,
  onOpenFavorites,
  onOpenSettings,
  onStartAdvanced,
  onOpenWord,
}: {
  app: AppStateApi;
  onOpenStudy: () => void;
  onOpenWrong: () => void;
  onOpenFavorites: () => void;
  onOpenSettings: () => void;
  onStartAdvanced: () => void;
  onOpenWord: (wordId: string) => void;
}) {
  const total = Math.max(app.stats.total, 1);
  const masteredPercent = Math.round((app.stats.mastered / total) * 100);
  const { taskSummary: summary, currentTask } = app;
  const progress = summary.total > 0 ? summary.completed / summary.total : 1;
  const remaining = Math.max(0, summary.total - summary.completed);
  const advancedRemaining = currentTask
    ? currentTask.advancedWordIds.filter((id) => !currentTask.completedWordIds.includes(id)).length
    : 0;
  const hasTaskWords = app.taskQueue.length > 0;
  const isComplete = currentTask?.status === 'completed' && advancedRemaining === 0;
  const canStartAdvanced = isComplete && (currentTask?.advancedWordIds.length ?? 0) === 0;
  const estimatedMinutes = Math.max(1, Math.ceil((remaining + advancedRemaining) * 0.45));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>WORD FLOW</Text>
            <Text style={styles.greeting}>今天，轻松记一点。</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenSettings} style={({ pressed }) => [styles.packPill, pressed && styles.pressed]}>
            <Text style={styles.packPillLabel}>当前词库</Text>
            <Text style={styles.packPillValue} numberOfLines={1}>{app.activePack?.title ?? '未选择'}</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasTaskWords ? `继续今日任务，剩余 ${app.taskQueue.length} 个单词` : canStartAdvanced ? '提前学习明日新词' : '查看薄弱词'}
          onPress={hasTaskWords ? onOpenStudy : canStartAdvanced ? onStartAdvanced : onOpenWrong}
          style={({ pressed }) => [styles.focusCard, pressed && styles.pressed]}
        >
          <View style={styles.focusHeader}>
            <Text style={styles.focusEyebrow}>{isComplete ? 'TODAY / 今日完成' : 'TODAY / 今日任务'}</Text>
            <Text style={styles.timeText}>{isComplete ? '做得很好' : `约 ${estimatedMinutes} 分钟`}</Text>
          </View>

          <View>
            <Text style={styles.focusNumber}>{isComplete ? summary.completed : remaining + advancedRemaining}</Text>
            <Text style={styles.focusUnit}>{isComplete ? '个今日任务已完成' : '个词待完成'}</Text>
          </View>

          <ProgressBar
            progress={progress}
            trackColor="#CFDAA9"
            fillColor={colors.accentDeep}
          />

          <View style={styles.taskBreakdown}>
            <Text style={styles.taskCount}>复习 {summary.reviewCompleted} / {summary.reviewTotal}</Text>
            <Text style={styles.taskCount}>新学 {summary.newCompleted} / {summary.newTotal}</Text>
            {summary.catchUpTotal > 0 ? <Text style={styles.taskCount}>补学 {summary.catchUpCompleted} / {summary.catchUpTotal}</Text> : null}
            {currentTask?.skippedRelearningIds.length ? <Text style={styles.taskCount}>短时重学 {currentTask.skippedRelearningIds.length}</Text> : null}
          </View>

          <View style={styles.focusFooter}>
            <Text style={styles.focusHint}>
              {hasTaskWords
                ? `本批最多 ${app.currentPlan.batchSize} 个 · 今日共 ${summary.total}`
                : isComplete
                  ? currentTask?.skippedRelearningIds.length
                    ? `还有 ${currentTask.skippedRelearningIds.length} 个错词将在 10 分钟后到期，不阻塞今日完成`
                    : `明日预计复习 ${app.tomorrowReviewCount} + 新学 ${app.currentPlan.dailyNewWordTarget}`
                  : '薄弱词仍可随时巩固'}
            </Text>
            <View style={styles.primaryCta}>
              <Text style={styles.primaryCtaText}>{hasTaskWords ? (summary.completed > 0 ? '继续学习' : '开始任务') : canStartAdvanced ? '提前学习' : '去巩固'}</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.statsRow}>
          <StatCard value={`${masteredPercent}%`} label="已掌握" />
          <View style={styles.statDivider} />
          <StatCard value={app.wrongWords.length.toString()} label="薄弱词" />
          <View style={styles.statDivider} />
          <StatCard value={app.favorites.length.toString()} label="已收藏" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>QUICK ACCESS</Text>
          <Text style={styles.sectionTitle}>快速入口</Text>
        </View>
        <View style={styles.quickGrid}>
          <QuickAction
            icon="flame-outline"
            label="薄弱词"
            hint="优先补齐记忆缺口"
            onPress={onOpenWrong}
          />
          <QuickAction
            icon="star-outline"
            label="我的收藏"
            hint="集中查看重点词"
            onPress={onOpenFavorites}
          />
        </View>

        {app.taskQueue.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>UP NEXT</Text>
                <Text style={styles.sectionTitle}>接下来学习</Text>
              </View>
              <Text style={styles.sectionMeta}>剩余 {app.taskQueue.length} 个</Text>
            </View>
            {app.taskQueue.slice(0, 3).map((entry) => (
              <WordRow
                key={entry.id}
                entry={entry}
                rightLabel={app.getTaskWordType(entry.id) === 'review' ? '到期复习' : app.getTaskWordType(entry.id) === 'catch_up' ? '补学' : app.getTaskWordType(entry.id) === 'advanced' ? '提前' : '新词'}
                onPress={() => onOpenWord(entry.id)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
      <View style={styles.quickIconWrap}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.lg },
  brand: { ...typography.eyebrow, color: colors.accent },
  greeting: { color: colors.textPrimary, fontSize: 24, lineHeight: 31, fontWeight: '700', letterSpacing: -0.4, marginTop: 6 },
  packPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  packPillLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: '600' },
  packPillValue: { color: colors.textPrimary, fontSize: 12, fontWeight: '600', marginTop: 3 },
  focusCard: { backgroundColor: colors.accentSoft, borderRadius: radius.xxl, padding: spacing.xxl, gap: spacing.lg },
  focusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  focusEyebrow: { ...typography.eyebrow, color: colors.accentDeep, letterSpacing: 1.2 },
  timeText: { color: '#5C6A50', fontSize: 12, fontWeight: '600' },
  focusNumber: { color: colors.accentInk, fontSize: 56, lineHeight: 62, fontWeight: '800', letterSpacing: -2 },
  focusUnit: { color: '#3B4730', fontSize: 16, fontWeight: '600', marginTop: 2 },
  taskBreakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: -spacing.xs },
  taskCount: { color: '#3B4730', fontSize: 12, fontWeight: '600' },
  focusFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 },
  focusHint: { flex: 1, color: '#5C6A50', fontSize: 12, lineHeight: 18, fontWeight: '500' },
  primaryCta: { backgroundColor: colors.accentInk, borderRadius: radius.lg, paddingHorizontal: 17, paddingVertical: 12 },
  primaryCtaText: { color: colors.accentSoft, fontSize: 13, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg + 1,
  },
  statDivider: { width: 1, height: 30, backgroundColor: colors.borderSoft },
  section: { gap: spacing.sm + 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.xs },
  sectionEyebrow: { ...typography.eyebrow, color: colors.textTertiary, fontSize: 10, letterSpacing: 1.6 },
  sectionTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginTop: 4 },
  sectionMeta: { color: colors.textTertiary, fontSize: 12, fontWeight: '500' },
  quickGrid: { flexDirection: 'row', gap: spacing.md },
  quickCard: {
    flex: 1,
    minHeight: 124,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  quickIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: spacing.lg - 4 },
  quickHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  pressed: { opacity: pressedOpacity },
});
