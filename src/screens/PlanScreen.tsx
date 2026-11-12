import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { addDays, isIntroduced } from '../domain/studyPlan';
import { localDateKey } from '../domain/review';
import { AppStateApi } from '../hooks/useAppState';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';
import { colors, pressedOpacity, radius, spacing, typography } from '../theme';

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];
const strategies = [
  { key: 'smooth' as const, label: '平滑补学', hint: '未来每天最多增加 30%' },
  { key: 'shift' as const, label: '顺延计划', hint: '不增加次日压力' },
  { key: 'next_day' as const, label: '次日补齐', hint: '遗漏新词全部放到下一天' },
];

export function PlanScreen({ app }: { app: AppStateApi }) {
  const plan = app.currentPlan;
  const introduced = app.deck.filter(isIntroduced).length;
  const mastered = app.stats.mastered;
  const remaining = app.deck.length - introduced;
  const deadline = plan.targetDate ? new Date(`${plan.targetDate}T12:00:00`) : addDays(new Date(), 180);

  const updateDeadline = (deltaDays: number) => {
    const nextDate = addDays(deadline, deltaDays);
    let studyDays = 0;
    for (let date = new Date(); date <= nextDate; date = addDays(date, 1)) {
      if (plan.studyWeekdays.includes(date.getDay())) studyDays += 1;
    }
    app.updateStudyPlan({
      mode: 'deadline',
      targetDate: localDateKey(nextDate),
      dailyNewWordTarget: Math.min(100, Math.max(5, Math.ceil(remaining / Math.max(1, studyDays)))),
    });
  };

  const changeNumber = (field: 'dailyNewWordTarget' | 'batchSize', delta: number) => {
    const limits = field === 'dailyNewWordTarget' ? [5, 100] : [5, 30];
    app.updateStudyPlan({ [field]: Math.min(limits[1], Math.max(limits[0], plan[field] + delta)) });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>CURRENT PLAN</Text>
          <Text style={styles.title}>{app.activePack?.title ?? '当前词库'}</Text>
          <Text style={styles.finishDate}>预计 {app.estimatedCompletionDate} 完成新词</Text>
          <ProgressBar
            progress={app.deck.length ? introduced / app.deck.length : 0}
            trackColor="#CED9AA"
            fillColor={colors.accentDeep}
            style={styles.heroProgress}
          />
          <View style={styles.statsRow}>
            <StatCard tone="light" label="已学" value={introduced.toString()} />
            <StatCard tone="light" label="已掌握" value={mastered.toString()} />
            <StatCard tone="light" label="未学" value={remaining.toString()} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>目标方式</Text>
          <View style={styles.modeRow}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: plan.mode === 'deadline' }} onPress={() => app.updateStudyPlan({ mode: 'deadline', targetDate: plan.targetDate ?? localDateKey(deadline) })} style={({ pressed }) => [styles.modeCard, plan.mode === 'deadline' && styles.modeCardActive, pressed && styles.pressed]}>
              <Text style={styles.modeTitle}>按考试日期</Text><Text style={styles.modeHint}>自动换算每日新词</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: plan.mode === 'daily_words' }} onPress={() => app.updateStudyPlan({ mode: 'daily_words' })} style={({ pressed }) => [styles.modeCard, plan.mode === 'daily_words' && styles.modeCardActive, pressed && styles.pressed]}>
              <Text style={styles.modeTitle}>按每日词数</Text><Text style={styles.modeHint}>保持固定学习节奏</Text>
            </Pressable>
          </View>
          {plan.mode === 'deadline' ? (
            <CounterRow label="目标日期" hint="调整后自动重算每日新词" value={`${deadline.getMonth() + 1}月${deadline.getDate()}日`} onMinus={() => updateDeadline(-30)} onPlus={() => updateDeadline(30)} />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>学习节奏</Text>
          <CounterRow
            label="每日新词"
            hint="决定计划完成日期"
            value={plan.dailyNewWordTarget}
            onMinus={() => changeNumber('dailyNewWordTarget', -5)}
            onPlus={() => changeNumber('dailyNewWordTarget', 5)}
          />
          <CounterRow
            label="单次批次"
            hint="只影响每批卡片数量"
            value={plan.batchSize}
            onMinus={() => changeNumber('batchSize', -5)}
            onPlus={() => changeNumber('batchSize', 5)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>每周学习日</Text>
          <View style={styles.weekRow}>
            {weekdayLabels.map((label, day) => {
              const active = plan.studyWeekdays.includes(day);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={label}
                  accessibilityLabel={`星期${label}${active ? '，学习日' : '，休息日'}`}
                  onPress={() => {
                    const next = active
                      ? plan.studyWeekdays.filter((value) => value !== day)
                      : [...plan.studyWeekdays, day].sort();
                    if (next.length > 0) app.updateStudyPlan({ studyWeekdays: next });
                  }}
                  style={[styles.dayButton, active && styles.dayButtonActive]}
                >
                  <Text style={[styles.dayText, active && styles.dayTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>补学策略</Text>
          {strategies.map((strategy) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: plan.catchUpStrategy === strategy.key }}
              key={strategy.key}
              onPress={() => app.updateStudyPlan({ catchUpStrategy: strategy.key })}
              style={[styles.option, plan.catchUpStrategy === strategy.key && styles.optionActive]}
            >
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{strategy.label}</Text>
                <Text style={styles.optionHint}>{strategy.hint}</Text>
              </View>
              <Ionicons
                name={plan.catchUpStrategy === strategy.key ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={plan.catchUpStrategy === strategy.key ? colors.accent : colors.textTertiary}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>未来 7 天负荷</Text>
          <View style={styles.forecastCard}>
            {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
              const date = addDays(new Date(), offset);
              const studyDay = plan.studyWeekdays.includes(date.getDay());
              const predictedReview = Math.round(introduced * 0.035 + offset * plan.dailyNewWordTarget * 0.18);
              const total = predictedReview + (studyDay ? plan.dailyNewWordTarget : 0);
              return (
                <View key={offset} style={styles.forecastColumn}>
                  <View style={styles.barArea}>
                    <View style={[styles.reviewBar, { height: Math.min(56, predictedReview * 1.4 + 4) }]} />
                    {studyDay ? <View style={[styles.newBar, { height: Math.min(72, plan.dailyNewWordTarget * 1.4) }]} /> : null}
                  </View>
                  <Text style={styles.forecastTotal}>{total}</Text>
                  <Text style={styles.forecastDay}>{offset === 0 ? '今' : weekdayLabels[date.getDay()]}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.legend}>深色为预测复习 · 亮色为计划新词；预测会随学习结果变化</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CounterRow({ label, hint, value, onMinus, onPlus }: { label: string; hint: string; value: number | string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.counterCard}>
      <View><Text style={styles.counterLabel}>{label}</Text><Text style={styles.counterHint}>{hint}</Text></View>
      <View style={styles.counterControls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`减少${label}`} onPress={onMinus} style={({ pressed }) => [styles.counterButton, pressed && styles.pressed]}>
          <Ionicons name="remove" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`增加${label}`} onPress={onPlus} style={({ pressed }) => [styles.counterButton, pressed && styles.pressed]}>
          <Ionicons name="add" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: 36, gap: spacing.xxl },
  heroCard: { backgroundColor: colors.accentSoft, borderRadius: radius.xxl, padding: spacing.xl, gap: spacing.sm + 2 },
  eyebrow: { ...typography.eyebrow, color: colors.accentDeep, letterSpacing: 1.6 },
  title: { color: colors.accentInk, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  finishDate: { color: '#5C6A50', fontSize: 13, fontWeight: '500' },
  heroProgress: { marginTop: 6 },
  statsRow: { flexDirection: 'row', marginTop: 6 },
  section: { gap: spacing.sm + 2 },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  modeRow: { flexDirection: 'row', gap: spacing.sm + 2 },
  modeCard: { flex: 1, borderRadius: radius.lg, padding: spacing.lg - 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
  modeCardActive: { borderColor: colors.accentDeep, backgroundColor: colors.surfaceAlt },
  modeTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  modeHint: { color: colors.textTertiary, fontSize: 10, lineHeight: 15, marginTop: 4 },
  counterCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg - 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  counterHint: { color: colors.textTertiary, fontSize: 11, marginTop: 4 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  counterButton: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  counterValue: { color: colors.accent, minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', gap: 7 },
  dayButton: { flex: 1, aspectRatio: 1, maxHeight: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  dayButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayText: { color: colors.textSecondary, fontWeight: '600' },
  dayTextActive: { color: colors.accentInk, fontWeight: '700' },
  option: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg - 2, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionActive: { borderColor: colors.accentDeep },
  optionText: { flex: 1 },
  optionLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  optionHint: { color: colors.textTertiary, fontSize: 11, marginTop: 3 },
  forecastCard: { height: 150, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg - 2, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  forecastColumn: { flex: 1, alignItems: 'center' },
  barArea: { height: 82, justifyContent: 'flex-end', alignItems: 'center', gap: 2, flexDirection: 'row' },
  reviewBar: { width: 6, minHeight: 4, backgroundColor: colors.textTertiary, borderRadius: 4 },
  newBar: { width: 8, minHeight: 4, backgroundColor: colors.accent, borderRadius: 4 },
  forecastTotal: { color: colors.textSecondary, fontSize: 10, fontWeight: '600', marginTop: 5 },
  forecastDay: { color: colors.textTertiary, fontSize: 10, marginTop: 3 },
  legend: { color: colors.textTertiary, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: pressedOpacity },
});
