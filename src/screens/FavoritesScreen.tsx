import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WordRow } from '../components/WordRow';
import { AppStateApi } from '../hooks/useAppState';
import { filterWords } from '../domain/text';

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
          <Text style={styles.emptyText}>
            {app.state.searchQuery ? '没有找到匹配的收藏词。' : '还没有收藏单词，去详情页点一下收藏吧。'}
          </Text>
        }
        renderItem={({ item }) => (
          <WordRow entry={item} rightLabel="收藏" onPress={() => onOpenWord(item.id)} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b100e',
  },
  container: {
    padding: 20,
    paddingTop: 8,
    gap: 10,
  },
  listIntro: {
    paddingBottom: 14,
    gap: 5,
  },
  subtitle: {
    color: '#7d8981',
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    color: '#f1f4ee',
    fontSize: 19,
    fontWeight: '900',
  },
  emptyText: {
    color: '#94a3b8',
    lineHeight: 22,
  },
});
