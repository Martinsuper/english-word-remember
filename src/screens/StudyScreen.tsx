import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RatingButton } from '../components/RatingButton';
import { AutoScalingText } from '../components/AutoScalingText';
import { AppStateApi } from '../hooks/useAppState';
import { ReviewRating } from '../types';

type Result = { wordId: string; rating: ReviewRating };

export function StudyScreen({ app, onExit }: { app: AppStateApi; onExit: () => void }) {
  const [batchIds, setBatchIds] = useState<string[]>(() => app.taskQueue.slice(0, app.currentPlan.batchSize).map((word) => word.id));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [showBatchSummary, setShowBatchSummary] = useState(false);
  const wordId = batchIds[currentIndex];
  const word = wordId ? app.getWordById(wordId) : undefined;
  const taskType = wordId ? app.getTaskWordType(wordId) : undefined;
  const isAdvancedBatch = taskType === 'advanced';
  const advancedTotal = app.currentTask?.advancedWordIds.length ?? 0;
  const advancedPosition = Math.min(advancedTotal, app.taskSummary.advancedCompleted + 1);
  const dailyPosition = Math.min(app.taskSummary.total, app.taskSummary.completed + 1);
  const isRated = results.some((result) => result.wordId === wordId);
  const chineseFront = app.state.settings.cardFrontLanguage === 'chinese';

  const showWordAt = (index: number) => {
    if (index < 0 || index >= batchIds.length || index === currentIndex) return;
    setCurrentIndex(index);
    setFlipped(false);
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
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < 48) return;
          showWordAt(gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1);
        },
      }),
    [batchIds.length, currentIndex],
  );

  useEffect(() => {
    if (batchIds.length === 0 && app.taskQueue.length > 0 && !showBatchSummary) {
      setBatchIds(app.taskQueue.slice(0, app.currentPlan.batchSize).map((entry) => entry.id));
      setCurrentIndex(0);
    }
  }, [app.currentPlan.batchSize, app.taskQueue, batchIds.length, showBatchSummary]);

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
    setFlipped(false);
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
    setFlipped(false);
    setShowBatchSummary(false);
  };

  if (showBatchSummary) {
    const remainingAfterBatch = Math.max(0, app.taskQueue.length - batchIds.filter((id) => app.taskQueue.some((entry) => entry.id === id)).length);
    const dayComplete = remainingAfterBatch === 0;
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.summaryWrap}>
          <Text style={styles.kicker}>{dayComplete ? 'TODAY COMPLETE' : 'BATCH COMPLETE'}</Text>
          <Text style={styles.summaryTitle}>{dayComplete ? '今天的计划完成了。' : '这一批完成了。'}</Text>
          <Text style={styles.summarySubtitle}>
            {dayComplete
              ? `完成 ${app.taskSummary.completed} 个今日任务${app.taskSummary.advancedCompleted ? `，额外学习 ${app.taskSummary.advancedCompleted} 个` : ''}`
              : `今日仍有 ${remainingAfterBatch} 个，按小批继续就好`}
          </Text>
          <View style={styles.summaryCard}>
            <SummaryStat label="本批正确率" value={`${batchStats.accuracy}%`} />
            <SummaryStat label="模糊" value={batchStats.fuzzy.toString()} />
            <SummaryStat label="不认识" value={batchStats.again.toString()} />
          </View>
          {dayComplete ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>今日成果</Text>
              <Text style={styles.detailLine}>复习 {app.taskSummary.reviewCompleted} · 新学 {app.taskSummary.newCompleted} · 补学 {app.taskSummary.catchUpCompleted}</Text>
              <Text style={styles.detailLine}>明日计划新词 {app.currentPlan.dailyNewWordTarget}，复习量将按本次结果动态生成</Text>
            </View>
          ) : null}
          {!dayComplete ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`继续下一批，剩余 ${remainingAfterBatch} 个`} onPress={continueNextBatch} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>继续下一批</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => { app.startAdvancedLearning(); setShowBatchSummary(false); setBatchIds([]); setCurrentIndex(0); setResults([]); setFlipped(false); }} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>提前学习明日新词（{app.currentPlan.dailyNewWordTarget}）</Text>
            </Pressable>
          )}
          <Pressable onPress={onExit} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{dayComplete ? '完成今日，返回首页' : '稍后继续'}</Text></Pressable>
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
          <Pressable onPress={onExit} style={styles.primaryButton}><Text style={styles.primaryButtonText}>返回首页</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={onExit} style={styles.exitButton}><Text style={styles.exitText}>结束</Text></Pressable>
          <View style={styles.counters}>
            <Text style={styles.dailyCounter}>{isAdvancedBatch ? `提前任务 ${advancedPosition} / ${advancedTotal}` : `今日 ${dailyPosition} / ${app.taskSummary.total}`}</Text>
            <Text style={styles.batchCounter}>本批 {currentIndex + 1} / {batchIds.length}</Text>
          </View>
          <View style={styles.typePill}><Text style={styles.typeText}>{taskType === 'review' ? '复习' : taskType === 'catch_up' ? '补学' : taskType === 'advanced' ? '提前' : '新词'}</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${isAdvancedBatch ? (advancedTotal ? Math.min(100, (advancedPosition / advancedTotal) * 100) : 0) : app.taskSummary.total ? Math.min(100, (dailyPosition / app.taskSummary.total) * 100) : 100}%` }]} /></View>
        <View style={styles.studyOptions}>
          <Text style={styles.gestureHint}>右滑上一个 · 左滑下一个</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`切换闪卡正面语言，当前为${chineseFront ? '中文' : '英文'}`}
            onPress={() => app.updateSettings({ cardFrontLanguage: chineseFront ? 'english' : 'chinese' })}
            style={styles.frontLanguageButton}
          >
            <Text style={styles.frontLanguageText}>正面：{chineseFront ? '中文' : '英文'} ⇄</Text>
          </Pressable>
        </View>

        <View {...panResponder.panHandlers} style={styles.cardGestureLayer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${chineseFront ? word.meaning : word.term}，${flipped ? '已显示背面' : '点击显示背面'}，左右滑动切换单词`}
            onPress={() => setFlipped((value) => !value)}
            style={[styles.card, flipped && styles.cardBack]}
          >
            <Text style={styles.sideLabel}>{flipped ? (chineseFront ? 'WORD' : 'MEANING') : (chineseFront ? '中文' : 'WORD')}</Text>
            {!flipped ? (
              <View style={styles.wordBlock}>
                <AutoScalingText adjustsFontSizeToFit minimumFontScale={0.4} numberOfLines={1} style={chineseFront ? styles.frontMeaning : styles.word}>{chineseFront ? word.meaning || '暂无中文释义' : word.term}</AutoScalingText>
                {!chineseFront && app.state.settings.showPhonetic && word.phonetic ? <Text style={styles.phonetic}>{word.phonetic}</Text> : null}
              </View>
            ) : chineseFront ? (
              <View style={styles.meaningBlock}>
                <AutoScalingText adjustsFontSizeToFit minimumFontScale={0.4} numberOfLines={1} style={styles.word}>{word.term}</AutoScalingText>
                {app.state.settings.showPhonetic && word.phonetic ? <Text style={styles.phonetic}>{word.phonetic}</Text> : null}
                {app.state.settings.showExample && word.example ? (
                  <View style={styles.exampleBlock}>
                    <Text style={styles.example}>{word.example}</Text>
                    {app.state.settings.showExampleMeaning && word.exampleMeaning ? <Text style={styles.exampleMeaning}>{word.exampleMeaning}</Text> : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.meaningBlock}>
                <AutoScalingText adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={styles.backWord}>{word.term}</AutoScalingText>
                <Text style={styles.meaning}>{word.meaning}</Text>
                {app.state.settings.showExample && word.example ? (
                  <View style={styles.exampleBlock}>
                    <Text style={styles.example}>{word.example}</Text>
                    {app.state.settings.showExampleMeaning && word.exampleMeaning ? <Text style={styles.exampleMeaning}>{word.exampleMeaning}</Text> : null}
                  </View>
                ) : null}
              </View>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.tapHint}>{flipped ? '根据记忆情况完成评价' : `点击查看${chineseFront ? '英文' : '中文'}`}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.wordNavigation}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="上一个单词"
            disabled={currentIndex === 0}
            onPress={() => showWordAt(currentIndex - 1)}
            style={[styles.wordNavigationButton, currentIndex === 0 && styles.wordNavigationButtonDisabled]}
          >
            <Text style={styles.wordNavigationText}>‹ 上一个</Text>
          </Pressable>
          <Text style={styles.wordNavigationPosition}>{currentIndex + 1} / {batchIds.length}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="下一个单词"
            disabled={currentIndex === batchIds.length - 1}
            onPress={() => showWordAt(currentIndex + 1)}
            style={[styles.wordNavigationButton, currentIndex === batchIds.length - 1 && styles.wordNavigationButtonDisabled]}
          >
            <Text style={styles.wordNavigationText}>下一个 ›</Text>
          </Pressable>
        </View>

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
  return <View style={styles.summaryStat}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0b100e' }, container: { flex: 1, padding: 18, gap: 12 },
  topBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, exitButton: { width: 58, paddingVertical: 10, borderRadius: 15, backgroundColor: '#151c18', borderWidth: 1, borderColor: '#263129', alignItems: 'center' }, exitText: { color: '#c7d0c9', fontSize: 12, fontWeight: '800' }, counters: { alignItems: 'center', gap: 2 }, dailyCounter: { color: '#d8dfd9', fontSize: 13, fontWeight: '900' }, batchCounter: { color: '#758279', fontSize: 10, fontWeight: '700' }, typePill: { width: 58, borderRadius: 15, paddingVertical: 9, backgroundColor: '#263129', alignItems: 'center' }, typeText: { color: '#a3e635', fontSize: 11, fontWeight: '900' },
  progressTrack: { height: 4, backgroundColor: '#263129', borderRadius: 99, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: '#a3e635' }, studyOptions: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, gestureHint: { color: '#657169', fontSize: 10, fontWeight: '700' }, frontLanguageButton: { borderRadius: 12, backgroundColor: '#1d2720', paddingHorizontal: 10, paddingVertical: 7 }, frontLanguageText: { color: '#a3e635', fontSize: 10, fontWeight: '900' },
  cardGestureLayer: { flex: 1, minHeight: 350, maxHeight: 560, marginTop: 6 }, card: { flex: 1, backgroundColor: '#f5f7ee', borderRadius: 30, padding: 24, justifyContent: 'space-between' }, cardBack: { backgroundColor: '#eef7d5' }, sideLabel: { color: '#788077', fontSize: 10, letterSpacing: 2, fontWeight: '900' }, wordBlock: { alignItems: 'center', gap: 12 }, word: { color: '#10160f', fontSize: 46, lineHeight: 56, fontWeight: '900', textAlign: 'center' }, frontMeaning: { color: '#10160f', fontSize: 30, lineHeight: 43, fontWeight: '900', textAlign: 'center' }, phonetic: { color: '#697268', fontSize: 17, textAlign: 'center' }, meaningBlock: { gap: 15 }, backWord: { color: '#596b20', fontSize: 15, fontWeight: '900' }, meaning: { color: '#15200f', fontSize: 24, lineHeight: 34, fontWeight: '900' }, exampleBlock: { borderTopWidth: 1, borderTopColor: '#ced8ad', paddingTop: 14, gap: 7 }, example: { color: '#425039', fontSize: 14, lineHeight: 21 }, exampleMeaning: { color: '#6b7863', fontSize: 12, lineHeight: 19 }, cardFooter: { gap: 8 }, tapHint: { color: '#7a8378', fontSize: 12, fontWeight: '700', textAlign: 'center' }, wordNavigation: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, wordNavigationButton: { minWidth: 86, minHeight: 36, borderRadius: 12, backgroundColor: '#1d2720', alignItems: 'center', justifyContent: 'center' }, wordNavigationButtonDisabled: { opacity: 0.3 }, wordNavigationText: { color: '#d7dfd8', fontSize: 11, fontWeight: '900' }, wordNavigationPosition: { color: '#748078', fontSize: 10, fontWeight: '800' },
  ratingArea: { gap: 8 }, ratingHint: { color: '#87938a', fontSize: 11, textAlign: 'center' }, ratingRow: { flexDirection: 'row', gap: 8 }, ratingDisabled: { opacity: 0.34 },
  summaryWrap: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 }, emptyWrap: { flex: 1, justifyContent: 'center', padding: 28, gap: 14 }, kicker: { color: '#a3e635', fontSize: 10, letterSpacing: 2, fontWeight: '900' }, summaryTitle: { color: '#f4f7f2', fontSize: 30, lineHeight: 38, fontWeight: '900' }, summarySubtitle: { color: '#8c998f', fontSize: 14, lineHeight: 21 }, summaryCard: { flexDirection: 'row', backgroundColor: '#151c18', borderRadius: 22, borderWidth: 1, borderColor: '#263129', paddingVertical: 18 }, summaryStat: { flex: 1, alignItems: 'center' }, summaryValue: { color: '#f4f7f2', fontSize: 22, fontWeight: '900' }, summaryLabel: { color: '#748078', fontSize: 10, marginTop: 4 }, detailCard: { backgroundColor: '#151c18', borderRadius: 20, padding: 16, gap: 7 }, detailTitle: { color: '#eef2ee', fontSize: 15, fontWeight: '900' }, detailLine: { color: '#849087', fontSize: 12, lineHeight: 18 }, primaryButton: { backgroundColor: '#eef7d5', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 5 }, primaryButtonText: { color: '#172009', fontSize: 14, fontWeight: '900' }, secondaryButton: { borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a352d' }, secondaryButtonText: { color: '#aeb8b0', fontSize: 13, fontWeight: '800' },
});
