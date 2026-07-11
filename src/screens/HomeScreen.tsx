import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WordRow } from '../components/WordRow';
import { AppStateApi } from '../hooks/useAppState';

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
          <Pressable accessibilityRole="button" onPress={onOpenSettings} style={styles.packPill}>
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

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(summary.completed > 0 ? 4 : 0, progress * 100)}%` }]} />
          </View>

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
          <Stat value={`${masteredPercent}%`} label="已掌握" />
          <View style={styles.statDivider} />
          <Stat value={app.wrongWords.length.toString()} label="薄弱词" />
          <View style={styles.statDivider} />
          <Stat value={app.favorites.length.toString()} label="已收藏" />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>QUICK ACCESS</Text>
            <Text style={styles.sectionTitle}>快速入口</Text>
          </View>
        </View>
        <View style={styles.quickGrid}>
          <QuickAction number="01" label="薄弱词" hint="优先补齐记忆缺口" onPress={onOpenWrong} />
          <QuickAction number="02" label="我的收藏" hint="集中查看重点词" onPress={onOpenFavorites} />
        </View>

        {app.taskQueue.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View>
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  number,
  label,
  hint,
  onPress,
}: {
  number: string;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
      <Text style={styles.quickNumber}>{number}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0b100e' },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, gap: 22 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  brand: { color: '#a3e635', fontSize: 11, letterSpacing: 2.2, fontWeight: '900' },
  greeting: { color: '#f7f8f3', fontSize: 25, lineHeight: 32, fontWeight: '900', marginTop: 5 },
  packPill: {
    width: 112,
    backgroundColor: '#151c18',
    borderWidth: 1,
    borderColor: '#263129',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  packPillLabel: { color: '#69766e', fontSize: 10, fontWeight: '800' },
  packPillValue: { color: '#dbe3dc', fontSize: 12, fontWeight: '800', marginTop: 3 },
  focusCard: { backgroundColor: '#eef7d5', borderRadius: 28, padding: 22, gap: 22 },
  focusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  focusEyebrow: { color: '#566b17', fontSize: 11, letterSpacing: 1.2, fontWeight: '900' },
  timeText: { color: '#56634d', fontSize: 12, fontWeight: '800' },
  focusNumber: { color: '#11180a', fontSize: 68, lineHeight: 72, fontWeight: '900', letterSpacing: -3 },
  focusUnit: { color: '#34402a', fontSize: 18, fontWeight: '800', marginTop: 2 },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: '#cfdaa9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#607b12' },
  taskBreakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: -10 },
  taskCount: { color: '#34402a', fontSize: 12, fontWeight: '900' },
  focusFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 },
  focusHint: { flex: 1, color: '#59664f', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  primaryCta: { backgroundColor: '#172009', borderRadius: 16, paddingHorizontal: 17, paddingVertical: 12 },
  primaryCtaText: { color: '#f5f8eb', fontSize: 13, fontWeight: '900' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151c18',
    borderWidth: 1,
    borderColor: '#263129',
    borderRadius: 22,
    paddingVertical: 17,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: '#f7f8f3', fontSize: 21, fontWeight: '900' },
  statLabel: { color: '#77847b', fontSize: 11, fontWeight: '700' },
  statDivider: { width: 1, height: 30, backgroundColor: '#2a352d' },
  section: { gap: 10 },
  sectionHeader: { marginBottom: -8 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionEyebrow: { color: '#718077', fontSize: 10, letterSpacing: 1.7, fontWeight: '900' },
  sectionTitle: { color: '#f1f4ee', fontSize: 20, fontWeight: '900', marginTop: 4 },
  sectionMeta: { color: '#718077', fontSize: 12, fontWeight: '700' },
  quickGrid: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1,
    minHeight: 130,
    backgroundColor: '#151c18',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#263129',
    padding: 16,
  },
  quickNumber: { color: '#a3e635', fontSize: 10, letterSpacing: 1.5, fontWeight: '900' },
  quickLabel: { color: '#f1f4ee', fontSize: 17, fontWeight: '900', marginTop: 22 },
  quickHint: { color: '#7d8981', fontSize: 12, lineHeight: 18, marginTop: 5 },
  pressed: { opacity: 0.72 },
});
