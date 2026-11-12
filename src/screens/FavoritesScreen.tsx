import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WordRow } from '../components/WordRow';
import { AppStateApi } from '../hooks/useAppState';
import { filterWords } from '../domain/text';
import { colors, spacing } from '../theme';

export function FavoritesScreen({
  app,
  onOpenWord,
}: {
  app: AppStateApi;
  onOpenWord: (wordId: string) => void;
}) {
  const visibleFavorites = useMemo(
    () => filterWords(app.favorites, app.state.searchQuery),
    [app.favorites, app.state.searchQuery],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={visibleFavorites}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.container}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        ListHeaderComponent={
          <View style={styles.listIntro}>
            <Text style={styles.sectionTitle}>收藏词</Text>
            <Text style={styles.subtitle}>把需要重点记忆的词放在一起，随时抽查。</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="star-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {app.state.searchQuery ? '没有找到匹配的收藏词。' : '还没有收藏单词，去详情页点一下收藏吧。'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <WordRow entry={item} rightLabel="收藏" onPress={() => onOpenWord(item.id)} />
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
