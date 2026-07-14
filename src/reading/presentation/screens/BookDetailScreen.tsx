import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookRepository } from '../../infrastructure/database/repositories/bookRepository';
import { progressRepository } from '../../infrastructure/database/repositories/progressRepository';
import { readingFileStore } from '../../infrastructure/files/readingFileStore';
import type { ReadingBook, ReadingChapter } from '../../domain/models';
import type { ReadingStackParamList } from '../../../navigation/types';

type NavProp = NativeStackNavigationProp<ReadingStackParamList>;

export function BookDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavProp>();
  const { bookId } = route.params as { bookId: string };

  const [book, setBook] = useState<ReadingBook | null>(null);
  const [chapters, setChapters] = useState<ReadingChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasProgress, setHasProgress] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [loadedBook, loadedChapters, progress] = await Promise.all([
        bookRepository.getBook(bookId),
        bookRepository.listChapters(bookId),
        progressRepository.getProgress(bookId),
      ]);
      setBook(loadedBook);
      setChapters(loadedChapters);
      setHasProgress(progress !== null);
    } catch (error) {
      console.error('Failed to load book:', error);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const startReading = async () => {
    if (!book) return;
    await bookRepository.updateLastOpened(bookId);
    navigation.navigate('Reader', { bookId });
  };

  const handleDelete = () => {
    if (!book) return;

    Alert.alert(
      '删除书籍',
      `确定要删除"${book.title}"吗？\n\n文件大小：${formatFileSize(book.fileSize)}\n\n删除后文件将被清除，但已加入的生词不会被删除。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookRepository.updateBookStatus(bookId, 'deleting');
              await progressRepository.deleteProgress(bookId);
              await readingFileStore.deleteBookFiles(bookId);
              await bookRepository.deleteBook(bookId);
              navigation.goBack();
            } catch (error) {
              console.error('Failed to delete book:', error);
              await bookRepository.updateBookStatus(bookId, 'ready');
              Alert.alert('删除失败', '请稍后重试');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a3e635" />
        </View>
      </SafeAreaView>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>书籍不存在</Text>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>返回书库</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const linearChapters = chapters.filter((ch) => ch.linear);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteText}>删除</Text>
        </Pressable>
      </View>

      <View style={styles.bookHeader}>
        {book.coverPath ? (
          <Image source={{ uri: book.coverPath }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.coverText}>📖</Text>
          </View>
        )}
        <View style={styles.bookMeta}>
          <Text style={styles.bookTitle}>{book.title}</Text>
          {book.author ? <Text style={styles.bookAuthor}>{book.author}</Text> : null}
          <Text style={styles.bookDetail}>
            {book.language ? `${book.language} · ` : ''}
            {formatFileSize(book.fileSize)}
            {book.epubVersion ? ` · EPUB ${book.epubVersion}` : ''}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={startReading}
        style={({ pressed }) => [styles.readButton, pressed && styles.readButtonPressed]}
      >
        <Text style={styles.readButtonText}>
          {hasProgress ? '继续阅读' : '开始阅读'}
        </Text>
      </Pressable>

      <View style={styles.tocHeader}>
        <Text style={styles.tocTitle}>目录</Text>
        <Text style={styles.tocCount}>{linearChapters.length} 章</Text>
      </View>

      <FlatList
        data={linearChapters}
        renderItem={({ item, index }) => (
          <Pressable
            style={({ pressed }) => [styles.chapterItem, pressed && styles.chapterItemPressed]}
            onPress={() => navigation.navigate('Reader', {
              bookId,
              locator: { chapterId: item.id, progression: 0 },
            })}
          >
            <Text style={styles.chapterNumber}>{index + 1}</Text>
            <Text style={styles.chapterTitle} numberOfLines={2}>{item.title}</Text>
          </Pressable>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.tocList}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b100e' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#f7f8f3', fontSize: 16, marginBottom: 12 },
  backLink: { color: '#a3e635', fontSize: 16, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: { paddingVertical: 4, paddingHorizontal: 4 },
  backText: { color: '#a3e635', fontSize: 16, fontWeight: '700' },
  deleteButton: { paddingVertical: 4, paddingHorizontal: 4 },
  deleteText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  bookHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  cover: { width: 100, height: 136, borderRadius: 8, marginRight: 16 },
  coverPlaceholder: {
    backgroundColor: '#263129',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverText: { fontSize: 40 },
  bookMeta: { flex: 1, justifyContent: 'center' },
  bookTitle: { color: '#f7f8f3', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  bookAuthor: { color: '#a3e635', fontSize: 14, marginBottom: 6 },
  bookDetail: { color: '#829087', fontSize: 12 },
  readButton: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#a3e635',
    alignItems: 'center',
  },
  readButtonPressed: { opacity: 0.8 },
  readButtonText: { color: '#0b100e', fontSize: 16, fontWeight: '800' },
  tocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  tocTitle: { color: '#f7f8f3', fontSize: 16, fontWeight: '700' },
  tocCount: { color: '#829087', fontSize: 13 },
  tocList: { paddingHorizontal: 20, paddingBottom: 20 },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2420',
  },
  chapterItemPressed: { opacity: 0.7 },
  chapterNumber: {
    color: '#566b17',
    fontSize: 12,
    fontWeight: '800',
    width: 32,
    textAlign: 'center',
  },
  chapterTitle: { flex: 1, color: '#f7f8f3', fontSize: 14, fontWeight: '600', marginLeft: 8 },
});
