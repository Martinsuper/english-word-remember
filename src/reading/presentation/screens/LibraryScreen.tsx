import { useState, useEffect, useCallback } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookRepository } from '../../infrastructure/database/repositories/bookRepository';
import { importBook, ImportProgress } from '../../application/importBook';
import { readingFileStore } from '../../infrastructure/files/readingFileStore';
import type { ReadingBook } from '../../domain/models';
import type { ReadingStackParamList } from '../../../navigation/types';

type NavProp = NativeStackNavigationProp<ReadingStackParamList>;

export function LibraryScreen() {
  const navigation = useNavigation<NavProp>();
  const [books, setBooks] = useState<ReadingBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

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

  const openBook = (bookId: string) => {
    navigation.navigate('BookDetail', { bookId });
  };

  const stageLabels: Record<string, string> = {
    copying: '复制文件',
    validating: '校验内容',
    parsing: '解析书籍',
    extracting: '提取资源',
    committing: '保存数据',
  };

  const renderBook = ({ item }: { item: ReadingBook }) => (
    <Pressable
      style={({ pressed }) => [styles.bookCard, pressed && styles.bookCardPressed]}
      onPress={() => openBook(item.id)}
    >
      {item.coverPath ? (
        <Image source={{ uri: item.coverPath }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Text style={styles.coverText}>📖</Text>
        </View>
      )}
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
        {item.author ? <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text> : null}
        <Text style={styles.bookMeta}>
          {formatFileSize(item.fileSize)}
          {' · '}
          {formatDate(item.importedAt)}
        </Text>
        {item.lastOpenedAt ? (
          <Text style={styles.bookMeta}>上次读于 {formatDate(item.lastOpenedAt)}</Text>
        ) : null}
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a3e635" />
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
          onPress={handleImport}
          disabled={importing}
          style={({ pressed }) => [styles.importButton, importing && styles.importButtonDisabled, pressed && styles.importButtonPressed]}
        >
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
          <Text style={styles.emptyEmoji}>📚</Text>
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b100e' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: { color: '#a3e635', fontSize: 11, letterSpacing: 2, fontWeight: '900' },
  headerTitle: { color: '#f7f8f3', fontSize: 28, fontWeight: '900', marginTop: 4 },
  importButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#a3e635',
  },
  importButtonDisabled: { opacity: 0.5 },
  importButtonPressed: { opacity: 0.8 },
  importButtonText: { color: '#0b100e', fontWeight: '800', fontSize: 14 },
  progressBar: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#151c18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#263129',
  },
  progressStage: { color: '#a3e635', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  progressTrack: { height: 4, backgroundColor: '#263129', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#a3e635', borderRadius: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#151c18',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#263129',
  },
  bookCardPressed: { opacity: 0.8 },
  cover: { width: 72, height: 96, borderRadius: 8, marginRight: 12 },
  coverPlaceholder: {
    backgroundColor: '#263129',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverText: { fontSize: 28 },
  bookInfo: { flex: 1, justifyContent: 'center' },
  bookTitle: { color: '#f7f8f3', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  bookAuthor: { color: '#a3e635', fontSize: 13, marginBottom: 4 },
  bookMeta: { color: '#829087', fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#f7f8f3', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyHint: { color: '#829087', fontSize: 14, textAlign: 'center' },
});
