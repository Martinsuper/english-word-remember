import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addDays, isIntroduced } from '../domain/studyPlan';
import { localDateKey } from '../domain/review';
import { AppStateApi } from '../hooks/useAppState';

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
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${app.deck.length ? (introduced / app.deck.length) * 100 : 0}%` }]} />
          </View>
          <View style={styles.statsRow}>
            <PlanStat label="已学" value={introduced} />
            <PlanStat label="已掌握" value={mastered} />
            <PlanStat label="未学" value={remaining} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>目标方式</Text>
          <View style={styles.modeRow}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: plan.mode === 'deadline' }} onPress={() => app.updateStudyPlan({ mode: 'deadline', targetDate: plan.targetDate ?? localDateKey(deadline) })} style={[styles.modeCard, plan.mode === 'deadline' && styles.modeCardActive]}>
              <Text style={styles.modeTitle}>按考试日期</Text><Text style={styles.modeHint}>自动换算每日新词</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: plan.mode === 'daily_words' }} onPress={() => app.updateStudyPlan({ mode: 'daily_words' })} style={[styles.modeCard, plan.mode === 'daily_words' && styles.modeCardActive]}>
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
              <Text style={styles.optionMark}>{plan.catchUpStrategy === strategy.key ? '●' : '○'}</Text>
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

function PlanStat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function CounterRow({ label, hint, value, onMinus, onPlus }: { label: string; hint: string; value: number | string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.counterCard}>
      <View><Text style={styles.counterLabel}>{label}</Text><Text style={styles.counterHint}>{hint}</Text></View>
      <View style={styles.counterControls}>
        <Pressable accessibilityRole="button" onPress={onMinus} style={styles.counterButton}><Text style={styles.counterButtonText}>−</Text></Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable accessibilityRole="button" onPress={onPlus} style={styles.counterButton}><Text style={styles.counterButtonText}>＋</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0b100e' },
  container: { padding: 20, paddingTop: 8, paddingBottom: 36, gap: 22 },
  heroCard: { backgroundColor: '#eef7d5', borderRadius: 26, padding: 20, gap: 10 },
  eyebrow: { color: '#607b12', fontSize: 10, letterSpacing: 1.8, fontWeight: '900' },
  title: { color: '#11180a', fontSize: 24, fontWeight: '900' },
  finishDate: { color: '#536149', fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 7, backgroundColor: '#ced9aa', borderRadius: 99, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', backgroundColor: '#607b12' },
  statsRow: { flexDirection: 'row', marginTop: 6 },
  stat: { flex: 1 }, statValue: { color: '#172009', fontSize: 20, fontWeight: '900' }, statLabel: { color: '#627057', fontSize: 11, marginTop: 2 },
  section: { gap: 10 }, sectionTitle: { color: '#f4f7f2', fontSize: 18, fontWeight: '900' },
  modeRow: { flexDirection: 'row', gap: 10 }, modeCard: { flex: 1, borderRadius: 18, padding: 14, backgroundColor: '#151c18', borderWidth: 1, borderColor: '#263129' }, modeCardActive: { borderColor: '#8eaa3b', backgroundColor: '#1c2619' }, modeTitle: { color: '#eef2ee', fontSize: 13, fontWeight: '900' }, modeHint: { color: '#748078', fontSize: 10, lineHeight: 15, marginTop: 4 },
  counterCard: { backgroundColor: '#151c18', borderRadius: 20, borderWidth: 1, borderColor: '#263129', padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterLabel: { color: '#f0f3ef', fontSize: 14, fontWeight: '800' }, counterHint: { color: '#758279', fontSize: 11, marginTop: 4 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 12 }, counterButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#29332c', alignItems: 'center', justifyContent: 'center' }, counterButtonText: { color: '#dce5dd', fontSize: 18, fontWeight: '900' }, counterValue: { color: '#a3e635', minWidth: 28, textAlign: 'center', fontSize: 17, fontWeight: '900' },
  weekRow: { flexDirection: 'row', gap: 7 }, dayButton: { flex: 1, aspectRatio: 1, maxHeight: 44, borderRadius: 14, backgroundColor: '#151c18', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#263129' }, dayButtonActive: { backgroundColor: '#a3e635', borderColor: '#a3e635' }, dayText: { color: '#7d8981', fontWeight: '800' }, dayTextActive: { color: '#172009' },
  option: { backgroundColor: '#151c18', borderRadius: 18, borderWidth: 1, borderColor: '#263129', padding: 14, flexDirection: 'row', alignItems: 'center' }, optionActive: { borderColor: '#708b23' }, optionText: { flex: 1 }, optionLabel: { color: '#eef2ee', fontSize: 14, fontWeight: '800' }, optionHint: { color: '#768279', fontSize: 11, marginTop: 3 }, optionMark: { color: '#a3e635', fontSize: 18 },
  forecastCard: { height: 150, backgroundColor: '#151c18', borderRadius: 20, borderWidth: 1, borderColor: '#263129', padding: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 7 }, forecastColumn: { flex: 1, alignItems: 'center' }, barArea: { height: 82, justifyContent: 'flex-end', alignItems: 'center', gap: 2, flexDirection: 'row' }, reviewBar: { width: 6, minHeight: 4, backgroundColor: '#536258', borderRadius: 4 }, newBar: { width: 8, minHeight: 4, backgroundColor: '#a3e635', borderRadius: 4 }, forecastTotal: { color: '#dce3dd', fontSize: 10, fontWeight: '800', marginTop: 5 }, forecastDay: { color: '#748078', fontSize: 10, marginTop: 3 }, legend: { color: '#6f7c73', fontSize: 11, lineHeight: 17 },
});
