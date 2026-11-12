import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookRepository } from '../../infrastructure/database/repositories/bookRepository';
import { progressRepository } from '../../infrastructure/database/repositories/progressRepository';
import { importBook, ImportProgress } from '../../application/importBook';
import { readingFileStore } from '../../infrastructure/files/readingFileStore';
import { deleteReadingBook } from '../../application/deleteBook';
import { formatDate, formatFileSize } from '../utils/format';
import { colors, pressedOpacity, radius, spacing, typography } from '../../../theme';
import type { ReadingBook } from '../../domain/models';
import type { ReadingStackParamList } from '../../../navigation/types';

type NavProp = NativeStackNavigationProp<ReadingStackParamList>;

export function LibraryScreen() {
  const navigation = useNavigation<NavProp>();
  const [books, setBooks] = useState<ReadingBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const openSwipeableRef = useRef<Swipeable | null>(null);

  const loadBooks = useCallback(async () => {
    try {
      const loaded = await bookRepository.listBooks();
      setBooks(loaded);
    } catch (error) {
      console.error('Failed to load books:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    readingFileStore.initialize()
      .then(() => readingFileStore.cleanupOldTemp())
      .catch(() => {});
    loadBooks();
  }, [loadBooks]);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks]),
  );

  const handleImport = async () => {
    if (importing) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (!asset.name?.toLowerCase().endsWith('.epub') && asset.mimeType !== 'application/epub+zip') {
        Alert.alert('不支持的格式', '请选择 .epub 格式的文件');
        return;
      }

      setImporting(true);
      setImportProgress({ stage: 'copying', percent: 0 });

      const importResult = await importBook(asset.uri, asset.name, (progress) => {
        setImportProgress(progress);
      });

      if (importResult.duplicate) {
        Alert.alert('重复导入', '这本书已经导入过了', [
          { text: '查看', onPress: () => navigation.navigate('BookDetail', { bookId: importResult.bookId }) },
          { text: '确定' },
        ]);
      }

      await loadBooks();
    } catch (error) {
      console.error('Import failed:', error);
      const message = error instanceof Error ? error.message : '导入失败';
      Alert.alert('导入失败', message);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const openBook = async (bookId: string) => {
    const progress = await progressRepository.getProgress(bookId);
    if (progress) {
      navigation.navigate('Reader', { bookId, locator: progress.locator });
      return;
    }
    navigation.navigate('BookDetail', { bookId });
  };

  const confirmDelete = (book: ReadingBook, closeRow: () => void) => {
    if (deletingBookId) return;
    Alert.alert(
      '从书架删除',
      `确定删除“${book.title}”吗？\n\n将释放 ${formatFileSize(book.fileSize)}，阅读进度和书籍文件会被清除；已加入的生词及原句会保留。`,
      [
        { text: '取消', style: 'cancel', onPress: closeRow },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setDeletingBookId(book.id);
            try {
              await deleteReadingBook(book.id);
              setBooks((current) => current.filter((item) => item.id !== book.id));
            } catch (error) {
              console.error('Failed to delete book:', error);
              Alert.alert('删除失败', '书籍没有被完整删除，请稍后重试。');
              await loadBooks();
              closeRow();
            } finally {
              setDeletingBookId(null);
            }
          },
        },
      ],
    );
  };

  const stageLabels: Record<string, string> = {
    copying: '复制文件',
    validating: '校验内容',
    parsing: '解析书籍',
    extracting: '提取资源',
    committing: '保存数据',
  };

  const renderBook = ({ item }: { item: ReadingBook }) => (
    <SwipeableBookRow
      book={item}
      deleting={deletingBookId === item.id}
      onOpen={(row) => {
        if (openSwipeableRef.current && openSwipeableRef.current !== row) {
          openSwipeableRef.current.close();
        }
        openSwipeableRef.current = row;
      }}
      onPress={() => openBook(item.id)}
      onDetail={() => navigation.navigate('BookDetail', { bookId: item.id })}
      onDelete={(closeRow) => confirmDelete(item, closeRow)}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>READING</Text>
          <Text style={styles.headerTitle}>我的书架</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="导入 EPUB 书籍"
          onPress={handleImport}
          disabled={importing}
          style={({ pressed }) => [styles.importButton, importing && styles.importButtonDisabled, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={16} color={colors.accentInk} />
          <Text style={styles.importButtonText}>
            {importing ? '导入中...' : '导入 EPUB'}
          </Text>
        </Pressable>
      </View>

      {importing && importProgress ? (
        <View style={styles.progressBar}>
          <Text style={styles.progressStage}>{stageLabels[importProgress.stage] || importProgress.stage}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${importProgress.percent}%` }]} />
          </View>
        </View>
      ) : null}

      {books.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="book-outline" size={40} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>还没有导入任何书籍</Text>
          <Text style={styles.emptyHint}>点击右上角"导入 EPUB"开始阅读之旅</Text>
        </View>
      ) : (
        <FlatList
          data={books}
          renderItem={renderBook}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function SwipeableBookRow({
  book,
  deleting,
  onOpen,
  onPress,
  onDetail,
  onDelete,
}: {
  book: ReadingBook;
  deleting: boolean;
  onOpen: (row: Swipeable) => void;
  onPress: () => void;
  onDetail: () => void;
  onDelete: (closeRow: () => void) => void;
}) {
  const rowRef = useRef<Swipeable | null>(null);
  const closeRow = () => rowRef.current?.close();

  return (
    <Swipeable
      ref={rowRef}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`删除${book.title}`}
          disabled={deleting}
          onPress={() => onDelete(closeRow)}
          style={styles.swipeDeleteAction}
        >
          {deleting
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Ionicons name="trash-outline" size={20} color="#fff" /><Text style={styles.swipeDeleteText}>删除</Text></>}
        </Pressable>
      )}
      rightThreshold={44}
      overshootRight={false}
      friction={1.6}
      onSwipeableWillOpen={() => rowRef.current && onOpen(rowRef.current)}
      containerStyle={styles.swipeRow}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`打开${book.title}`}
        accessibilityHint="向左滑动可以删除书籍"
        style={({ pressed }) => [styles.bookCard, pressed && styles.pressed]}
        onPress={onPress}
      >
        {book.coverPath ? (
          <Image source={{ uri: book.coverPath }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="image-outline" size={26} color={colors.textTertiary} />
          </View>
        )}
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
          {book.author ? <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text> : null}
          <Text style={styles.bookMeta}>{formatFileSize(book.fileSize)} · {formatDate(book.importedAt)}</Text>
          {book.lastOpenedAt ? <Text style={styles.bookMeta}>上次读于 {formatDate(book.lastOpenedAt)} · 点击继续</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`查看${book.title}详情`}
          onPress={(event) => { event.stopPropagation(); onDetail(); }}
          style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
        </Pressable>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg + 2,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  headerTitle: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  importButtonDisabled: { opacity: 0.5 },
  importButtonText: { color: colors.accentInk, fontWeight: '600', fontSize: 14 },
  progressBar: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressStage: { color: colors.accent, fontSize: 12, fontWeight: '600', marginBottom: 7 },
  progressTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: colors.accent, borderRadius: 3 },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  swipeRow: { marginBottom: spacing.md, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.danger },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { width: 72, height: 96, borderRadius: radius.sm, marginRight: spacing.md },
  coverPlaceholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookInfo: { flex: 1, justifyContent: 'center' },
  detailButton: { alignSelf: 'center', width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  swipeDeleteAction: { width: 88, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, gap: 4 },
  swipeDeleteText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bookTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  bookAuthor: { color: colors.accent, fontSize: 13, marginBottom: 4 },
  bookMeta: { color: colors.textSecondary, fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, gap: spacing.sm + 2 },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: spacing.sm - 2 },
  emptyHint: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  pressed: { opacity: pressedOpacity },
});
