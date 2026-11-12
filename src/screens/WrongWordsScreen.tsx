import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WordRow } from '../components/WordRow';
import { AppStateApi } from '../hooks/useAppState';
import { filterWords } from '../domain/text';
import { colors, spacing } from '../theme';

export function WrongWordsScreen({
  app,
  onOpenWord,
}: {
  app: AppStateApi;
  onOpenWord: (wordId: string) => void;
}) {
  const visibleWrongWords = useMemo(
    () => filterWords(app.wrongWords, app.state.searchQuery),
    [app.wrongWords, app.state.searchQuery],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={visibleWrongWords}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.container}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        ListHeaderComponent={
          <View style={styles.listIntro}>
            <Text style={styles.sectionTitle}>优先巩固</Text>
            <Text style={styles.subtitle}>错误次数越多，排序越靠前。</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {app.state.searchQuery ? '没有找到匹配的错词。' : '还没有错词，继续保持。'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <WordRow
            entry={item}
            rightLabel={`错 ${item.state.wrongCount} 次`}
            onPress={() => onOpenWord(item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: 36, gap: spacing.sm + 2 },
  listIntro: { paddingBottom: 14, gap: 5 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  sectionTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  emptyWrap: { alignItems: 'center', gap: spacing.md, paddingTop: 64 },
  emptyText: { color: colors.textTertiary, lineHeight: 22, textAlign: 'center' },
});
