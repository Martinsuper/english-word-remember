import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RatingButton } from '../components/RatingButton';
import { AutoScalingText } from '../components/AutoScalingText';
import { ProgressBar } from '../components/ProgressBar';
import { PrimaryButton } from '../components/PrimaryButton';
import { AppStateApi } from '../hooks/useAppState';
import { ReviewRating } from '../types';
import { getWordExamples } from '../domain/wordExamples';
import { colors, pressedOpacity, radius, spacing, typography } from '../theme';

type Result = { wordId: string; rating: ReviewRating };

// 卡面配色（亮面卡在暗底上，保留纸感）。
const CARD_FRONT_BG = '#F5F7EE';
const CARD_BACK_BG = '#EEF7D5';

export function StudyScreen({ app, onExit }: { app: AppStateApi; onExit: () => void }) {
  const [batchIds, setBatchIds] = useState<string[]>(() => app.taskQueue.slice(0, app.currentPlan.batchSize).map((word) => word.id));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [showBatchSummary, setShowBatchSummary] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const wordId = batchIds[currentIndex];
  const word = wordId ? app.getWordById(wordId) : undefined;
  const taskType = wordId ? app.getTaskWordType(wordId) : undefined;
  const isAdvancedBatch = taskType === 'advanced';
  const advancedTotal = app.currentTask?.advancedWordIds.length ?? 0;
  const advancedPosition = Math.min(advancedTotal, app.taskSummary.advancedCompleted + 1);
  const dailyPosition = Math.min(app.taskSummary.total, app.taskSummary.completed + 1);
  const isRated = results.some((result) => result.wordId === wordId);
  const chineseFront = app.state.settings.cardFrontLanguage === 'chinese';
  const examples = word ? getWordExamples(word) : [];
  const currentExample = examples[Math.min(exampleIndex, Math.max(0, examples.length - 1))];

  // 翻转动画：rotateY 0↔180，正反两面常驻、backfaceVisibility 隐藏。
  const flipAnim = useRef(new Animated.Value(0)).current;
  // 滑卡跟手位移。
  const swipeX = useRef(new Animated.Value(0)).current;

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });
  const cardRotate = swipeX.interpolate({
    inputRange: [-320, 0, 320],
    outputRange: ['-6deg', '0deg', '6deg'],
  });

  const resetFlip = (animated: boolean) => {
    setFlipped(false);
    flipAnim.stopAnimation();
    if (animated) {
      Animated.timing(flipAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else {
      flipAnim.setValue(0);
    }
  };

  const toggleFlip = () => {
    const next = !flipped;
    setFlipped(next);
    Animated.timing(flipAnim, {
      toValue: next ? 180 : 0,
      duration: 260,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const showWordAt = (index: number) => {
    if (index < 0 || index >= batchIds.length || index === currentIndex) return;
    setCurrentIndex(index);
    resetFlip(false);
    setExampleIndex(0);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => {
          swipeX.setValue(gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) >= 48) {
            const target = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1;
            // 滑出屏幕后瞬间摆到对侧，再弹回，形成连续滑卡感。
            Animated.timing(swipeX, {
              toValue: gesture.dx * 2.2,
              duration: 160,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (!finished) return;
              swipeX.setValue(gesture.dx < 0 ? 72 : -72);
              showWordAt(target);
              Animated.spring(swipeX, {
                toValue: 0,
                useNativeDriver: true,
                speed: 24,
                bounciness: 6,
              }).start();
            });
          } else {
            Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, speed: 28, bounciness: 5 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [batchIds.length, currentIndex, swipeX, flipAnim],
  );

  useEffect(() => {
    if (batchIds.length === 0 && app.taskQueue.length > 0 && !showBatchSummary) {
      setBatchIds(app.taskQueue.slice(0, app.currentPlan.batchSize).map((entry) => entry.id));
      setCurrentIndex(0);
    }
  }, [app.currentPlan.batchSize, app.taskQueue, batchIds.length, showBatchSummary]);

  useEffect(() => {
    setExampleIndex(0);
  }, [wordId]);

  const batchStats = useMemo(() => {
    const known = results.filter((result) => result.rating === 'good').length;
    const fuzzy = results.filter((result) => result.rating === 'hard').length;
    const again = results.filter((result) => result.rating === 'again').length;
    return { known, fuzzy, again, accuracy: results.length ? Math.round((known / results.length) * 100) : 0 };
  }, [results]);

  const rate = (rating: ReviewRating) => {
    if (!word || isRated) return;
    app.reviewTaskWord(word.id, rating);
    const nextResults = [...results, { wordId: word.id, rating }];
    setResults(nextResults);
    if (nextResults.length >= batchIds.length) {
      setShowBatchSummary(true);
      return;
    }
    const ratedIds = new Set(nextResults.map((result) => result.wordId));
    const nextIndex = batchIds.findIndex((id, index) => index > currentIndex && !ratedIds.has(id));
    const fallbackIndex = batchIds.findIndex((id) => !ratedIds.has(id));
    setCurrentIndex(nextIndex >= 0 ? nextIndex : fallbackIndex);
    resetFlip(false);
  };

  const continueNextBatch = () => {
    const completedInBatch = new Set(batchIds);
    const next = app.taskQueue
      .filter((entry) => !completedInBatch.has(entry.id))
      .slice(0, app.currentPlan.batchSize)
      .map((entry) => entry.id);
    setBatchIds(next);
    setCurrentIndex(0);
    setResults([]);
    resetFlip(false);
    setShowBatchSummary(false);
  };

  const overallProgress = isAdvancedBatch
    ? advancedTotal
      ? advancedPosition / advancedTotal
      : 0
    : app.taskSummary.total
      ? dailyPosition / app.taskSummary.total
      : 1;

  if (showBatchSummary) {
    const remainingAfterBatch = Math.max(0, app.taskQueue.length - batchIds.filter((id) => app.taskQueue.some((entry) => entry.id === id)).length);
    const dayComplete = remainingAfterBatch === 0;
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.summaryWrap} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>{dayComplete ? 'TODAY COMPLETE' : 'BATCH COMPLETE'}</Text>
          <Text style={styles.summaryTitle}>{dayComplete ? '今天的计划完成了。' : '这一批完成了。'}</Text>
          <Text style={styles.summarySubtitle}>
            {dayComplete
              ? `完成 ${app.taskSummary.completed} 个今日任务${app.taskSummary.advancedCompleted ? `，额外学习 ${app.taskSummary.advancedCompleted} 个` : ''}`
              : `今日仍有 ${remainingAfterBatch} 个，按小批继续就好`}
          </Text>
          <View style={styles.summaryCard}>
            <SummaryStat label="本批正确率" value={`${batchStats.accuracy}%`} />
            <View style={styles.summaryDivider} />
            <SummaryStat label="模糊" value={batchStats.fuzzy.toString()} />
            <View style={styles.summaryDivider} />
            <SummaryStat label="不认识" value={batchStats.again.toString()} />
          </View>
          {dayComplete ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>今日成果</Text>
              <Text style={styles.detailLine}>复习 {app.taskSummary.reviewCompleted} · 新学 {app.taskSummary.newCompleted} · 补学 {app.taskSummary.catchUpCompleted}</Text>
              <Text style={styles.detailLine}>明日计划新词 {app.currentPlan.dailyNewWordTarget}，复习量将按本次结果动态生成</Text>
            </View>
          ) : null}
          {dayComplete ? (
            <PrimaryButton
              label={`提前学习明日新词（${app.currentPlan.dailyNewWordTarget}）`}
              onPress={() => { app.startAdvancedLearning(); setShowBatchSummary(false); setBatchIds([]); setCurrentIndex(0); setResults([]); resetFlip(false); }}
              style={styles.summaryPrimarySpacing}
            />
          ) : (
            <PrimaryButton
              label={`继续下一批，剩余 ${remainingAfterBatch} 个`}
              onPress={continueNextBatch}
              style={styles.summaryPrimarySpacing}
            />
          )}
          <Pressable onPress={onExit} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>{dayComplete ? '完成今日，返回首页' : '稍后继续'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!word) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.kicker}>ALL CLEAR</Text>
          <Text style={styles.summaryTitle}>今天没有待学习单词。</Text>
          <PrimaryButton label="返回首页" onPress={onExit} />
        </View>
      </SafeAreaView>
    );
  }

  const frontIsMeaning = chineseFront;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="结束学习" onPress={onExit} style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.counters}>
            <Text style={styles.dailyCounter}>{isAdvancedBatch ? `提前任务 ${advancedPosition} / ${advancedTotal}` : `今日 ${dailyPosition} / ${app.taskSummary.total}`}</Text>
            <Text style={styles.batchCounter}>本批 {currentIndex + 1} / {batchIds.length}</Text>
          </View>
          <View style={styles.typePill}><Text style={styles.typeText}>{taskType === 'review' ? '复习' : taskType === 'catch_up' ? '补学' : taskType === 'advanced' ? '提前' : '新词'}</Text></View>
        </View>
        <ProgressBar progress={overallProgress} />
        <View style={styles.studyOptions}>
          <Text style={styles.gestureHint}>右滑上一个 · 左滑下一个</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`切换闪卡正面语言，当前为${chineseFront ? '中文' : '英文'}`}
            onPress={() => app.updateSettings({ cardFrontLanguage: chineseFront ? 'english' : 'chinese' })}
            style={({ pressed }) => [styles.frontLanguageButton, pressed && styles.pressed]}
          >
            <Ionicons name="swap-horizontal" size={13} color={colors.accent} />
            <Text style={styles.frontLanguageText}>正面：{chineseFront ? '中文' : '英文'}</Text>
          </Pressable>
        </View>

        <View style={styles.cardGestureLayer}>
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.cardGestureInner, { transform: [{ translateX: swipeX }, { rotate: cardRotate }] }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${chineseFront ? word.meaning : word.term}，${flipped ? '已显示背面' : '点击显示背面'}，左右滑动切换单词`}
              onPress={toggleFlip}
              style={styles.card}
            >
              {/* 正面 */}
              <Animated.View style={[styles.face, { backgroundColor: CARD_FRONT_BG, transform: [{ rotateY: frontRotate }] }]}>
                <Text style={styles.sideLabel}>{frontIsMeaning ? '中文' : 'WORD'}</Text>
                <View style={styles.wordBlock}>
                  <AutoScalingText adjustsFontSizeToFit minimumFontScale={0.4} numberOfLines={1} style={frontIsMeaning ? styles.frontMeaning : styles.word}>
                    {frontIsMeaning ? word.meaning || '暂无中文释义' : word.term}
                  </AutoScalingText>
                  {!frontIsMeaning && app.state.settings.showPhonetic && word.phonetic ? <Text style={styles.phonetic}>{word.phonetic}</Text> : null}
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.tapHint}>点击查看{frontIsMeaning ? '英文' : '中文'}</Text>
                </View>
              </Animated.View>
              {/* 背面 */}
              <Animated.View style={[styles.face, styles.faceBack, { backgroundColor: CARD_BACK_BG, transform: [{ rotateY: backRotate }] }]}>
                <Text style={styles.sideLabel}>{chineseFront ? 'WORD' : 'MEANING'}</Text>
                <View style={styles.meaningBlock}>
                  <AutoScalingText adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={styles.backWord}>{word.term}</AutoScalingText>
                  {app.state.settings.showPhonetic && word.phonetic ? <Text style={styles.phonetic}>{word.phonetic}</Text> : null}
                  <Text style={styles.meaning}>{word.meaning}</Text>
                  {app.state.settings.showExample && currentExample ? (
                    <View style={styles.exampleBlock}>
                      {currentExample.sense ? <Text style={styles.exampleSense}>{currentExample.sense}</Text> : null}
                      <Text style={styles.example}>{currentExample.sentence}</Text>
                      {app.state.settings.showExampleMeaning && currentExample.translation ? <Text style={styles.exampleMeaning}>{currentExample.translation}</Text> : null}
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.tapHint}>根据记忆情况完成评价</Text>
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.wordNavigation}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="上一个单词"
            disabled={currentIndex === 0}
            onPress={() => showWordAt(currentIndex - 1)}
            style={[styles.wordNavigationButton, currentIndex === 0 && styles.wordNavigationButtonDisabled]}
          >
            <Ionicons name="chevron-back" size={15} color={colors.textPrimary} />
            <Text style={styles.wordNavigationText}>上一个</Text>
          </Pressable>
          <Text style={styles.wordNavigationPosition}>{currentIndex + 1} / {batchIds.length}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="下一个单词"
            disabled={currentIndex === batchIds.length - 1}
            onPress={() => showWordAt(currentIndex + 1)}
            style={[styles.wordNavigationButton, currentIndex === batchIds.length - 1 && styles.wordNavigationButtonDisabled]}
          >
            <Text style={styles.wordNavigationText}>下一个</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textPrimary} />
          </Pressable>
        </View>

        {flipped && app.state.settings.showExample && examples.length > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`切换例句，当前第 ${exampleIndex + 1} 条，共 ${examples.length} 条`}
            onPress={() => setExampleIndex((value) => (value + 1) % examples.length)}
            style={({ pressed }) => [styles.exampleSwitcher, pressed && styles.pressed]}
          >
            <Text style={styles.exampleSwitcherText}>换条例句 · {exampleIndex + 1} / {examples.length}</Text>
          </Pressable>
        ) : null}

        <View style={styles.ratingArea}>
          <Text style={styles.ratingHint}>{isRated ? '这个词已完成评价，可左右滑动查看其他词' : flipped ? '这次记得怎么样？' : '先回忆，再点击卡片查看背面'}</Text>
          <View style={[styles.ratingRow, (!flipped || isRated) && styles.ratingDisabled]} pointerEvents={flipped && !isRated ? 'auto' : 'none'}>
            <RatingButton label="不认识" helper="10 分钟后" tone="danger" onPress={() => rate('again')} />
            <RatingButton label="模糊" helper="预计明天" tone="warning" onPress={() => rate('hard')} />
            <RatingButton label="认识" helper="按记忆增长" tone="success" onPress={() => rate('good')} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.lg + 2, gap: spacing.md },

  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counters: { alignItems: 'center', gap: 2 },
  dailyCounter: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  batchCounter: { color: colors.textTertiary, fontSize: 10, fontWeight: '500' },
  typePill: { minWidth: 52, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.accentMuted, alignItems: 'center' },
  typeText: { color: colors.accent, fontSize: 11, fontWeight: '600' },

  studyOptions: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gestureHint: { color: colors.textTertiary, fontSize: 10, fontWeight: '500' },
  frontLanguageButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 7 },
  frontLanguageText: { color: colors.accent, fontSize: 10, fontWeight: '600' },

  cardGestureLayer: { flex: 1, minHeight: 340, maxHeight: 560, marginTop: spacing.xs },
  cardGestureInner: { flex: 1 },
  card: { flex: 1 },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    justifyContent: 'space-between',
    backfaceVisibility: 'hidden',
  },
  faceBack: { transform: [{ rotateY: '180deg' }] },
  sideLabel: { color: '#7C857B', fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  wordBlock: { alignItems: 'center', gap: spacing.md },
  word: { color: colors.accentInk, fontSize: 46, lineHeight: 54, fontWeight: '800', textAlign: 'center' },
  frontMeaning: { color: colors.accentInk, fontSize: 30, lineHeight: 42, fontWeight: '700', textAlign: 'center' },
  phonetic: { color: '#6B7568', fontSize: 16, textAlign: 'center' },
  meaningBlock: { gap: spacing.lg - 1 },
  backWord: { color: colors.accentDeep, fontSize: 15, fontWeight: '700' },
  meaning: { color: colors.accentInk, fontSize: 23, lineHeight: 33, fontWeight: '700', letterSpacing: -0.2 },
  exampleBlock: { borderTopWidth: 1, borderTopColor: '#CED8AD', paddingTop: 14, gap: 7 },
  exampleSense: { alignSelf: 'flex-start', color: colors.accentDeep, backgroundColor: '#DCEBA9', borderRadius: radius.sm - 2, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '600' },
  example: { color: '#42503A', fontSize: 14, lineHeight: 21 },
  exampleMeaning: { color: '#6B7863', fontSize: 12, lineHeight: 19 },
  cardFooter: { gap: spacing.sm },
  tapHint: { color: '#7A8378', fontSize: 12, fontWeight: '500', textAlign: 'center' },

  wordNavigation: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordNavigationButton: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 84, minHeight: 36, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, justifyContent: 'center' },
  wordNavigationButtonDisabled: { opacity: 0.3 },
  wordNavigationText: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  wordNavigationPosition: { color: colors.textTertiary, fontSize: 10, fontWeight: '600' },
  exampleSwitcher: { alignSelf: 'center', borderRadius: radius.md, backgroundColor: colors.accentMuted, paddingHorizontal: 14, paddingVertical: 8 },
  exampleSwitcherText: { color: colors.accent, fontSize: 10, fontWeight: '600' },

  ratingArea: { gap: spacing.sm },
  ratingHint: { color: colors.textSecondary, fontSize: 11, textAlign: 'center' },
  ratingRow: { flexDirection: 'row', gap: spacing.sm },
  ratingDisabled: { opacity: 0.34 },

  summaryWrap: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl, gap: 14 },
  emptyWrap: { flex: 1, justifyContent: 'center', padding: 28, gap: 14 },
  kicker: { ...typography.eyebrow, color: colors.accent, fontSize: 10, letterSpacing: 2 },
  summaryTitle: { color: colors.textPrimary, fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 },
  summarySubtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg + 2,
  },
  summaryStat: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.borderSoft },
  summaryValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  summaryLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: '500' },
  detailCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: 7, borderWidth: 1, borderColor: colors.border },
  detailTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  detailLine: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  summaryPrimarySpacing: { marginTop: 5 },
  secondaryButton: { borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  pressed: { opacity: pressedOpacity },
});
