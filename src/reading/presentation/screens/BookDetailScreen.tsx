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
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookRepository } from '../../infrastructure/database/repositories/bookRepository';
import { progressRepository } from '../../infrastructure/database/repositories/progressRepository';
import { deleteReadingBook } from '../../application/deleteBook';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { formatFileSize } from '../utils/format';
import { colors, pressedOpacity, radius, spacing } from '../../../theme';
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
    const progress = await progressRepository.getProgress(bookId);
    await bookRepository.updateLastOpened(bookId);
    navigation.navigate('Reader', { bookId, locator: progress?.locator });
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
              await deleteReadingBook(bookId);
              navigation.goBack();
            } catch (error) {
              console.error('Failed to delete book:', error);
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
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!book) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>书籍不存在</Text>
          <PrimaryButton label="返回书库" onPress={() => navigation.goBack()} variant="soft" />
        </View>
      </SafeAreaView>
    );
  }

  const linearChapters = chapters.filter((ch) => ch.linear);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回书架"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
          <Text style={styles.backText}>书架</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="删除这本书"
          onPress={handleDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={17} color={colors.danger} />
          <Text style={styles.deleteText}>删除</Text>
        </Pressable>
      </View>

      <View style={styles.bookHeader}>
        {book.coverPath ? (
          <Image source={{ uri: book.coverPath }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="image-outline" size={36} color={colors.textTertiary} />
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

      <PrimaryButton
        label={hasProgress ? '继续阅读' : '开始阅读'}
        onPress={startReading}
        style={styles.readButton}
      />

      <View style={styles.tocHeader}>
        <Text style={styles.tocTitle}>目录</Text>
        <Text style={styles.tocCount}>{linearChapters.length} 章</Text>
      </View>

      <FlatList
        data={linearChapters}
        renderItem={({ item, index }) => (
          <Pressable
            style={({ pressed }) => [styles.chapterItem, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Reader', {
              bookId,
              locator: { chapterId: item.id, progression: 0 },
            })}
          >
            <Text style={styles.chapterNumber}>{index + 1}</Text>
            <Text style={styles.chapterTitle} numberOfLines={2}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
          </Pressable>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.tocList}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.textPrimary, fontSize: 16, marginBottom: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 1, marginLeft: -spacing.xs },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.dangerMuted },
  deleteText: { color: colors.dangerSoft, fontSize: 13, fontWeight: '600' },
  bookHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  cover: { width: 100, height: 136, borderRadius: radius.md, marginRight: spacing.lg },
  coverPlaceholder: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookMeta: { flex: 1, justifyContent: 'center' },
  bookTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6 },
  bookAuthor: { color: colors.accent, fontSize: 14, marginBottom: 6 },
  bookDetail: { color: colors.textSecondary, fontSize: 12 },
  readButton: { marginHorizontal: spacing.xl, marginBottom: spacing.lg },
  tocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  tocTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  tocCount: { color: colors.textSecondary, fontSize: 13 },
  tocList: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  chapterNumber: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    width: 24,
    textAlign: 'center',
  },
  chapterTitle: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  pressed: { opacity: pressedOpacity },
});
