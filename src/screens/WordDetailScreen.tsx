import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../components/PrimaryButton';
import { RatingButton } from '../components/RatingButton';
import { AppStateApi } from '../hooks/useAppState';
import { getWordProgressLabel, localDateKey } from '../domain/review';
import { ReviewRating } from '../types';
import { getWordExamples } from '../domain/wordExamples';
import { colors, pressedOpacity, radius, spacing } from '../theme';

export function WordDetailScreen({
  app,
  wordId,
  onBack,
  onSpeakWord,
  onReviewWord,
  onOpenSource,
}: {
  app: AppStateApi;
  wordId: string;
  onBack: () => void;
  onSpeakWord: (wordText: string) => void;
  onReviewWord?: (wordId: string, rating: ReviewRating) => void;
  onOpenSource?: () => void | Promise<void>;
}) {
  const word = app.getWordById(wordId);

  if (!word) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>没有找到这个单词。</Text>
          <PrimaryButton label="返回" onPress={onBack} variant="soft" />
        </View>
      </SafeAreaView>
    );
  }

  const favorite = app.isFavorite(wordId);
  const examples = getWordExamples(word);
  const sourceIndexLabel = '词表序号';
  const reviewWord = (rating: ReviewRating) => {
    if (onReviewWord) {
      onReviewWord(word.id, rating);
      return;
    }
    app.reviewWord(word.id, rating);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回"
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="朗读单词"
              onPress={() => onSpeakWord(word.term)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons name="volume-medium-outline" size={20} color={colors.accent} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={favorite ? '取消收藏' : '收藏'}
              onPress={() => app.toggleFavorite(wordId)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={favorite ? 'star' : 'star-outline'}
                size={20}
                color={favorite ? colors.accent : colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.wordHeader}>
            <Text style={styles.word}>{word.term}</Text>
            {word.phonetic ? <Text style={styles.phonetic}>{word.phonetic}</Text> : null}
          </View>
          {word.tags && word.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {word.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
            </View>
          ) : null}
          <Text style={styles.meta}>{getWordProgressLabel(word)}</Text>

          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>释义</Text>
            <Text style={styles.definition}>{word.meaning}</Text>
          </View>

          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>例句{examples.length > 1 ? ` · ${examples.length} 条` : ''}</Text>
            {examples.length > 0 ? examples.map((example, index) => (
              <View key={`${example.sentence}-${index}`} style={styles.exampleItem}>
                {example.sense ? <Text style={styles.exampleSense}>{example.sense}</Text> : null}
                <Text style={styles.example}>{example.sentence}</Text>
                {example.translation ? <Text style={styles.exampleMeaning}>{example.translation}</Text> : null}
              </View>
            )) : <Text style={styles.exampleMeaning}>暂无例句</Text>}
          </View>

          {word.sourceBook ? (
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>来源</Text>
              <Text style={styles.example}>
                {word.sourceBook}
                {word.sourcePage ? ` · ${sourceIndexLabel} ${word.sourcePage}` : ''}
              </Text>
              {word.rawText ? <Text style={styles.exampleMeaning}>{word.rawText}</Text> : null}
              {word.id.startsWith('reading-') && onOpenSource ? (
                <Pressable onPress={onOpenSource} style={({ pressed }) => [styles.sourceButton, pressed && styles.pressed]}>
                  <Ionicons name="book-outline" size={14} color={colors.accent} />
                  <Text style={styles.sourceButtonText}>返回原文</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.infoGrid}>
            <Info label="掌握次数" value={word.state.repetition.toString()} />
            <Info label="正确" value={word.state.correctCount.toString()} />
            <Info label="错误" value={word.state.wrongCount.toString()} />
            <Info
              label="下次复习"
              value={word.state.nextReviewAt ? localDateKey(new Date(word.state.nextReviewAt)) : '尚未引入'}
            />
          </View>

          <View style={styles.ratingRow}>
            <RatingButton label="不认识" tone="danger" onPress={() => reviewWord('again')} />
            <RatingButton label="模糊" tone="warning" onPress={() => reviewWord('hard')} />
            <RatingButton label="认识" tone="success" onPress={() => reviewWord('good')} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, gap: spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topActions: { flexDirection: 'row', gap: spacing.sm + 2 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg - 2,
  },
  wordHeader: { gap: 4 },
  word: { color: colors.textPrimary, fontSize: 36, fontWeight: '800', letterSpacing: -0.8 },
  phonetic: { color: colors.accent, fontSize: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { color: colors.accent, backgroundColor: colors.accentMuted, borderRadius: radius.sm - 2, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '600' },
  meta: { color: colors.textTertiary, fontSize: 13 },
  sectionBox: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4, color: colors.textTertiary },
  definition: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', lineHeight: 25 },
  example: { color: colors.textPrimary, fontSize: 15, lineHeight: 22, opacity: 0.92 },
  exampleItem: { gap: 6, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  exampleSense: { alignSelf: 'flex-start', color: colors.accent, backgroundColor: colors.accentMuted, borderRadius: radius.sm - 2, paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, fontWeight: '600' },
  exampleMeaning: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  sourceButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.accentMuted },
  sourceButtonText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  infoCard: { width: '48.5%', backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: 14, flexGrow: 1 },
  infoLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '500' },
  infoValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 5 },
  ratingRow: { flexDirection: 'row', gap: spacing.sm + 2 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText: { color: colors.textSecondary },
  pressed: { opacity: pressedOpacity },
});
