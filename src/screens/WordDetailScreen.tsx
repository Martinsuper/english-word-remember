import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RatingButton } from '../components/RatingButton';
import { AppStateApi } from '../hooks/useAppState';
import { getWordProgressLabel, localDateKey } from '../domain/review';
import { ReviewRating } from '../types';
import { getWordExamples } from '../domain/wordExamples';

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
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>返回</Text>
          </Pressable>
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
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>返回</Text>
          </Pressable>
          <View style={styles.topActions}>
            <Pressable onPress={() => onSpeakWord(word.term)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>朗读</Text>
            </Pressable>
            <Pressable onPress={() => app.toggleFavorite(wordId)} style={styles.favoriteButton}>
              <Text style={styles.favoriteButtonText}>{favorite ? '已收藏' : '收藏'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.word}>{word.term}</Text>
          <Text style={styles.phonetic}>{word.phonetic}</Text>
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
                <Pressable onPress={onOpenSource} style={styles.sourceButton}>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#101418',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  backButton: {
    backgroundColor: '#18212b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  backButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '800',
  },
  favoriteButton: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  favoriteButtonText: {
    color: '#0f172a',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 28,
    padding: 20,
    gap: 14,
  },
  word: {
    color: '#0f172a',
    fontSize: 38,
    fontWeight: '800',
  },
  phonetic: {
    color: '#475569',
    fontSize: 16,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { color: '#4d5f19', backgroundColor: '#dff0a8', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '800' },
  meta: {
    color: '#64748b',
    fontSize: 13,
  },
  sectionBox: {
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '700',
  },
  definition: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  example: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },
  exampleItem: {
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dbe3ff',
  },
  exampleSense: {
    alignSelf: 'flex-start',
    color: '#4d5f19',
    backgroundColor: '#dff0a8',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  exampleMeaning: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  sourceButton: { alignSelf: 'flex-start', marginTop: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#dff0a8' },
  sourceButtonText: { color: '#33420d', fontWeight: '800', fontSize: 13 },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoCard: {
    width: '48%',
    backgroundColor: '#18212b',
    borderRadius: 16,
    padding: 14,
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  infoValue: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 5,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emptyText: {
    color: '#f8fafc',
  },
});
