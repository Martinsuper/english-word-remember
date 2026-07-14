import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  AppState as NativeAppState,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookRepository } from '../../infrastructure/database/repositories/bookRepository';
import { progressRepository } from '../../infrastructure/database/repositories/progressRepository';
import { settingsRepository, ReaderSettings } from '../../infrastructure/database/repositories/settingsRepository';
import type { ReadingChapter, ReadingLocator } from '../../domain/models';
import type { ReadingStackParamList } from '../../../navigation/types';
import type { AppStateApi } from '../../../hooks/useAppState';
import { LookupSheet, LookupData } from '../components/LookupSheet';
import { isValidWordSelection, extractSentence } from '../../domain/wordSelection';

type NavProp = NativeStackNavigationProp<ReadingStackParamList>;

type BridgeMessage =
  | { type: 'READY'; chapterId: string }
  | { type: 'PROGRESS'; chapterId: string; progression: number }
  | { type: 'WORD_TAP'; word: string; contextBefore: string; contextAfter: string; progression: number }
  | { type: 'LINK_TAP'; href: string }
  | { type: 'CONTROLS_TOGGLE' };

export function ReaderScreen({ app }: { app: AppStateApi }) {
  const systemColorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation<NavProp>();
  const { bookId, locator: initialLocator } = route.params as {
    bookId: string;
    locator?: ReadingLocator;
  };

  const [chapters, setChapters] = useState<ReadingChapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chapterHtml, setChapterHtml] = useState('');
  const [controlsVisible, setControlsVisible] = useState(false);
  const [lookupData, setLookupData] = useState<LookupData | null>(null);
  const [bookTitle, setBookTitle] = useState('阅读原文');
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>({
    fontSize: 18, lineHeight: 1.65, marginSize: 20, theme: 'dark', fontFamily: 'serif', tapLookupEnabled: true,
  });
  const webViewRef = useRef<WebView>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreLocatorRef = useRef<ReadingLocator | undefined>(initialLocator);
  const latestLocatorRef = useRef<ReadingLocator | undefined>(initialLocator);
  const dark = readerSettings.theme === 'system'
    ? systemColorScheme !== 'light'
    : readerSettings.theme === 'dark';
  const readerColors = dark
    ? { background: '#171816', surface: '#21221F', border: '#343630', text: '#E7E3D9', muted: '#A8A49A', accent: '#C5A86A' }
    : { background: '#F5F0E6', surface: '#ECE5D8', border: '#D8CEBD', text: '#302E2A', muted: '#777168', accent: '#8A6336' };

  useEffect(() => {
    loadChapters();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [bookId]);

  useEffect(() => {
    if (chapters.length > 0 && currentChapterIndex >= 0 && currentChapterIndex < chapters.length) {
      loadChapterContent(currentChapterIndex);
    }
  }, [chapters, currentChapterIndex, readerSettings, dark]);

  const loadChapters = async () => {
    try {
      const [loaded, loadedBook, savedSettings, savedProgress] = await Promise.all([
        bookRepository.listChapters(bookId),
        bookRepository.getBook(bookId),
        settingsRepository.get(),
        initialLocator ? Promise.resolve(null) : progressRepository.getProgress(bookId),
      ]);
      setBookTitle(loadedBook?.title ?? '阅读原文');
      setReaderSettings(savedSettings);
      const linearChapters = loaded.filter((ch) => ch.linear);
      const locator = initialLocator ?? savedProgress?.locator;
      if (locator) {
        restoreLocatorRef.current = locator;
        latestLocatorRef.current = locator;
        const idx = linearChapters.findIndex((ch) => ch.id === locator.chapterId);
        if (idx >= 0) setCurrentChapterIndex(idx);
      }
      setChapters(linearChapters);
      await bookRepository.updateLastOpened(bookId);
    } catch (error) {
      console.error('Failed to load chapters:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChapterContent = async (index: number) => {
    const chapter = chapters[index];
    if (!chapter) return;

    try {
      const html = await readAsStringAsync(chapter.extractedPath);
      const locator = restoreLocatorRef.current?.chapterId === chapter.id ? restoreLocatorRef.current : undefined;
      const wrapped = wrapInReaderShell(html, chapter.id, locator);
      setChapterHtml(wrapped);
    } catch (error) {
      console.error('Failed to load chapter content:', error);
      setChapterHtml(wrapInReaderShell('<p>无法加载章节内容</p>', chapter.id));
    }
  };

  const wrapInReaderShell = (content: string, chapterId: string, locator?: ReadingLocator): string => {
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
<style>
  * { box-sizing: border-box; }
  html { background: ${readerColors.background}; }
  body {
    font-family: ${readerSettings.fontFamily === 'serif' ? "Charter, 'Iowan Old Style', 'Palatino Linotype', Georgia, serif" : "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"};
    font-size: ${readerSettings.fontSize}px;
    line-height: ${readerSettings.lineHeight};
    letter-spacing: 0.006em;
    color: ${readerColors.text};
    background-color: ${readerColors.background};
    padding: ${readerSettings.marginSize + 2}px ${readerSettings.marginSize}px 40px;
    margin: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    hanging-punctuation: first last;
    -webkit-user-select: text;
    user-select: text;
  }
  body, body * { border-color: ${readerColors.border}; }
  img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.1em auto; display: block; }
  a { color: ${readerColors.accent}; text-decoration-color: ${readerColors.accent}80; text-underline-offset: 0.15em; }
  h1, h2, h3, h4, h5, h6 {
    color: ${readerColors.text};
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    letter-spacing: -0.018em;
    margin: 1.5em 0 0.65em;
    line-height: 1.25;
  }
  h1 { font-size: 1.65em; margin-top: 0.5em; }
  h2 { font-size: 1.38em; }
  h3 { font-size: 1.18em; }
  p { margin: 0 0 1em; }
  blockquote { border-left: 3px solid ${readerColors.accent}; padding: 0.15em 0 0.15em 1em; margin: 1.3em 0; color: ${readerColors.muted}; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid ${readerColors.border}; padding: 0.6em; text-align: left; }
  th { background: ${readerColors.surface}; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.38em 0; }
  hr { border: 0; border-top: 1px solid ${readerColors.border}; margin: 1.8em 0; }
  ::selection { background: ${dark ? '#685936' : '#DFC58E'}; color: ${readerColors.text}; }
</style>
</head>
<body data-chapter-id="${chapterId}">
${content}
<script>
(function() {
  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  post({ type: 'READY', chapterId: '${chapterId}' });
  var restoreProgression = ${Math.min(1, Math.max(0, locator?.progression ?? 0))};
  if (restoreProgression > 0) {
    setTimeout(function() {
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, maxScroll * restoreProgression);
    }, 50);
  }

  var scrollTimer = null;
  var lastProgression = -1;
  function reportProgress() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    var scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;
    var progression = scrollHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollHeight)) : 0;
    if (Math.abs(progression - lastProgression) < 0.001) return;
    lastProgression = progression;
    post({ type: 'PROGRESS', chapterId: '${chapterId}', progression: progression });
  }
  window.addEventListener('scroll', function() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(reportProgress, 150);
  });
  setInterval(reportProgress, 500);
  setTimeout(reportProgress, 100);

  function getWordAtPoint(x, y) {
    var range = null;
    var selection = window.getSelection();
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
      }
    }
    if (!range || !range.startContainer) return null;

    var node = range.startContainer;
    var offset = range.startOffset;

    if (node.nodeType !== Node.TEXT_NODE) return null;

    var text = node.textContent;
    if (!text) return null;

    var start = offset;
    var end = offset;

    while (start > 0 && /[a-zA-Z'\\u2019-]/.test(text[start - 1])) start--;
    while (end < text.length && /[a-zA-Z'\\u2019-]/.test(text[end])) end++;

    var word = text.substring(start, end);
    if (!word || word.length === 0 || !/[a-zA-Z]/.test(word)) return null;

    var fullText = node.textContent || '';
    var sentenceStart = Math.max(0, start - 200);
    var sentenceEnd = Math.min(fullText.length, end + 200);
    var contextBefore = fullText.substring(sentenceStart, start);
    var contextAfter = fullText.substring(end, sentenceEnd);

    return { word: word, contextBefore: contextBefore, contextAfter: contextAfter };
  }

  function findLink(target) {
    while (target && target !== document.body) {
      if (target.tagName === 'A' && target.href) return target;
      target = target.parentElement;
    }
    return null;
  }

  document.addEventListener('click', function(e) {
    var target = e.target;
    var link = findLink(target);
    if (link) {
      e.preventDefault();
      post({ type: 'LINK_TAP', href: link.href });
      return;
    }
    var wordInfo = getWordAtPoint(e.clientX, e.clientY);
    if (!wordInfo || wordInfo.word.length <= 1 || wordInfo.word.length >= 80) return;
    post({
      type: 'WORD_TAP',
      word: wordInfo.word,
      contextBefore: wordInfo.contextBefore,
      contextAfter: wordInfo.contextAfter,
      progression: Math.max(0, Math.min(1, (window.pageYOffset || 0) / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)))
    });
  });
})();
</script>
</body>
</html>`;
  };

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = parseBridgeMessage(event.nativeEvent.data);
      if (!message) return;

      switch (message.type) {
        case 'READY':
          break;
        case 'PROGRESS':
          scheduleSaveProgress(message.chapterId, message.progression);
          break;
        case 'WORD_TAP':
          handleWordTap(message.word, message.contextBefore, message.contextAfter, message.progression);
          break;
        case 'LINK_TAP':
          break;
        case 'CONTROLS_TOGGLE':
          toggleControls();
          break;
      }
    } catch {
      // ignore invalid messages
    }
  }, [chapters, currentChapterIndex, readerSettings.tapLookupEnabled]);

  const handleWordTap = (word: string, contextBefore: string, contextAfter: string, progression: number) => {
    if (!readerSettings.tapLookupEnabled) return;
    if (!isValidWordSelection(word)) return;

    const chapter = chapters[currentChapterIndex];
    if (!chapter) return;

    const fullContext = contextBefore + word + contextAfter;
    const wordStart = contextBefore.length;
    const wordEnd = wordStart + word.length;
    const sentence = extractSentence(fullContext, wordStart, wordEnd);

    const locator: ReadingLocator = {
      chapterId: chapter.id,
      progression,
      textBefore: contextBefore.slice(-80),
      textQuote: word,
      textAfter: contextAfter.slice(0, 80),
    };

    setLookupData({
      word,
      sentence,
      bookId,
      chapterId: chapter.id,
      locator,
    });
  };

  const scheduleSaveProgress = (chapterId: string, progression: number) => {
    latestLocatorRef.current = { chapterId, progression };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const chapterCount = chapters.length;
        const currentIndex = chapters.findIndex((ch) => ch.id === chapterId);
        const overallProgress = chapterCount > 0 ? (currentIndex + progression) / chapterCount : 0;

        await progressRepository.saveProgress({
          bookId,
          locator: { chapterId, progression },
          overallProgress,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to save progress:', error);
      }
    }, 300);
  };

  const saveProgressNow = async () => {
    const chapter = chapters[currentChapterIndex];
    if (!chapter) return;
    try {
      await progressRepository.saveProgress({
        bookId,
        locator: latestLocatorRef.current?.chapterId === chapter.id
          ? latestLocatorRef.current
          : { chapterId: chapter.id, progression: 0 },
        overallProgress: chapters.length > 0
          ? (currentChapterIndex + (latestLocatorRef.current?.progression ?? 0)) / chapters.length
          : 0,
        updatedAt: new Date().toISOString(),
      });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (state) => {
      if (state === 'inactive' || state === 'background') saveProgressNow();
    });
    return () => subscription.remove();
  }, [chapters, currentChapterIndex]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      saveProgressNow();
    });
    return unsubscribe;
  }, [navigation, currentChapterIndex, chapters]);

  const goToPreviousChapter = async () => {
    if (currentChapterIndex > 0) {
      await saveProgressNow();
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  };

  const goToNextChapter = async () => {
    if (currentChapterIndex < chapters.length - 1) {
      await saveProgressNow();
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  };

  const toggleControls = () => {
    setControlsVisible((v) => !v);
  };

  const updateReaderSettings = (patch: Partial<ReaderSettings>) => {
    const next = { ...readerSettings, ...patch };
    setReaderSettings(next);
    settingsRepository.save(next).catch(() => undefined);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: readerColors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={readerColors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const currentChapter = chapters[currentChapterIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: readerColors.background }]} edges={[]}>
      <StatusBar style={dark ? 'light' : 'dark'} backgroundColor={readerColors.background} />

      <View style={styles.webviewContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: chapterHtml }}
          onMessage={handleMessage}
          onScroll={(event) => {
            const chapter = chapters[currentChapterIndex];
            if (!chapter) return;
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const maxScroll = Math.max(0, contentSize.height - layoutMeasurement.height);
            const progression = maxScroll > 0
              ? Math.min(1, Math.max(0, contentOffset.y / maxScroll))
              : 0;
            scheduleSaveProgress(chapter.id, progression);
          }}
          style={[styles.webview, { backgroundColor: readerColors.background }]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['about:blank', 'file://*']}
          onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('file:')}
          allowFileAccess
          allowFileAccessFromFileURLs
          scrollEnabled={true}
        />
      </View>

      {controlsVisible ? (
        <View style={[styles.bottomMenu, { paddingBottom: Math.max(12, insets.bottom + 6), backgroundColor: readerColors.background, borderTopColor: readerColors.border }]}>
          <View style={styles.menuTitleRow}>
            <Pressable onPress={() => navigation.goBack()} style={[styles.menuActionButton, { backgroundColor: readerColors.surface }]}>
              <Text style={[styles.menuActionText, { color: readerColors.accent }]}>← 返回</Text>
            </Pressable>
            <Text style={[styles.chapterTitle, { color: readerColors.text }]} numberOfLines={1}>
              {currentChapter?.title || `Chapter ${currentChapterIndex + 1}`}
            </Text>
            <Pressable onPress={toggleControls} style={[styles.menuActionButton, { backgroundColor: readerColors.surface }]}>
              <Text style={[styles.menuActionText, { color: readerColors.accent }]}>收起</Text>
            </Pressable>
          </View>

          <View style={styles.settingsGrid}>
            <Pressable style={[styles.settingButton, { backgroundColor: readerColors.surface }]} onPress={() => updateReaderSettings({ fontSize: Math.max(14, readerSettings.fontSize - 2) })}><Text style={[styles.settingsText, { color: readerColors.accent }]}>A− 字号</Text></Pressable>
            <Pressable style={[styles.settingButton, { backgroundColor: readerColors.surface }]} onPress={() => updateReaderSettings({ fontSize: Math.min(30, readerSettings.fontSize + 2) })}><Text style={[styles.settingsText, { color: readerColors.accent }]}>A＋ 字号</Text></Pressable>
            <Pressable style={[styles.settingButton, { backgroundColor: readerColors.surface }]} onPress={() => updateReaderSettings({ theme: dark ? 'light' : 'dark' })}><Text style={[styles.settingsText, { color: readerColors.accent }]}>{dark ? '日间模式' : '夜间模式'}</Text></Pressable>
            <Pressable style={[styles.settingButton, { backgroundColor: readerColors.surface }]} onPress={() => updateReaderSettings({ lineHeight: readerSettings.lineHeight >= 2.1 ? 1.3 : Math.round((readerSettings.lineHeight + 0.2) * 10) / 10 })}><Text style={[styles.settingsText, { color: readerColors.accent }]}>调整行距</Text></Pressable>
            <Pressable style={[styles.settingButton, { backgroundColor: readerColors.surface }]} onPress={() => updateReaderSettings({ fontFamily: readerSettings.fontFamily === 'serif' ? 'sans-serif' : 'serif' })}><Text style={[styles.settingsText, { color: readerColors.accent }]}>切换字体</Text></Pressable>
            <Pressable style={[styles.settingButton, { backgroundColor: readerColors.surface }]} onPress={() => updateReaderSettings({ tapLookupEnabled: !readerSettings.tapLookupEnabled })}><Text style={[styles.settingsText, { color: readerColors.accent }]}>{readerSettings.tapLookupEnabled ? '点击查词：开' : '点击查词：关'}</Text></Pressable>
          </View>

          <View style={styles.chapterNavigation}>
            <Pressable onPress={goToPreviousChapter} disabled={currentChapterIndex === 0} style={[styles.navButton, { backgroundColor: readerColors.surface }, currentChapterIndex === 0 && styles.navButtonDisabled]}>
              <Text style={[styles.navButtonText, { color: readerColors.accent }]}>上一章</Text>
            </Pressable>
            <Text style={[styles.chapterIndicator, { color: readerColors.muted }]}>{currentChapterIndex + 1} / {chapters.length}</Text>
            <Pressable onPress={goToNextChapter} disabled={currentChapterIndex === chapters.length - 1} style={[styles.navButton, { backgroundColor: readerColors.surface }, currentChapterIndex === chapters.length - 1 && styles.navButtonDisabled]}>
              <Text style={[styles.navButtonText, { color: readerColors.accent }]}>下一章</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开阅读菜单"
          onPress={toggleControls}
          style={[styles.collapsedMenuButton, { bottom: Math.max(10, insets.bottom + 6), backgroundColor: readerColors.surface, borderColor: readerColors.border }]}
        >
          <Text style={[styles.readerMenuButtonText, { color: readerColors.accent }]}>Aa 阅读菜单</Text>
        </Pressable>
      )}

      <LookupSheet
        visible={lookupData !== null}
        data={lookupData}
        app={app}
        bookTitle={bookTitle}
        onClose={() => setLookupData(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b100e' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#263129',
    backgroundColor: '#0b100e',
  },
  headerButton: { minWidth: 60 },
  headerButtonText: { color: '#a3e635', fontSize: 15, fontWeight: '700' },
  chapterTitle: { flex: 1, color: '#f7f8f3', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  webviewContainer: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0b100e' },
  navigation: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#263129',
    backgroundColor: '#0b100e',
  },
  settingsBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8, paddingLeft: 12, paddingRight: 58, backgroundColor: '#151c18', borderBottomWidth: StyleSheet.hairlineWidth },
  settingsText: { color: '#a3e635', fontWeight: '800', fontSize: 14 },
  readerMenuButton: { position: 'absolute', right: 10, zIndex: 20, width: 36, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  readerMenuButtonText: { fontSize: 15, lineHeight: 18, fontWeight: '800' },
  collapsedMenuButton: { position: 'absolute', alignSelf: 'center', zIndex: 20, minWidth: 124, height: 40, paddingHorizontal: 18, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  bottomMenu: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, paddingTop: 10, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  menuTitleRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  menuActionButton: { minWidth: 64, minHeight: 34, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuActionText: { fontSize: 13, fontWeight: '800' },
  settingsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 7, marginBottom: 9 },
  settingButton: { width: '32%', minHeight: 36, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  chapterNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#151c18',
    minWidth: 80,
    alignItems: 'center',
  },
  navButtonDisabled: { opacity: 0.3 },
  navButtonText: { color: '#a3e635', fontWeight: '700', fontSize: 13 },
  chapterIndicator: { color: '#829087', fontSize: 13 },
});

function parseBridgeMessage(raw: string): BridgeMessage | null {
  const value = JSON.parse(raw) as Record<string, unknown>;
  if (
    typeof value.type !== 'string' ||
    typeof value.chapterId !== 'string' &&
      value.type !== 'WORD_TAP' &&
      value.type !== 'LINK_TAP' &&
      value.type !== 'CONTROLS_TOGGLE'
  ) return null;
  if (value.type === 'READY' && typeof value.chapterId === 'string') return value as BridgeMessage;
  if (value.type === 'PROGRESS' && typeof value.chapterId === 'string' && typeof value.progression === 'number' && value.progression >= 0 && value.progression <= 1) return value as BridgeMessage;
  if (value.type === 'WORD_TAP' && typeof value.word === 'string' && value.word.length <= 80 && typeof value.contextBefore === 'string' && value.contextBefore.length <= 1000 && typeof value.contextAfter === 'string' && value.contextAfter.length <= 1000 && typeof value.progression === 'number') return value as BridgeMessage;
  if (value.type === 'LINK_TAP' && typeof value.href === 'string' && value.href.length <= 2048) return value as BridgeMessage;
  if (value.type === 'CONTROLS_TOGGLE') return value as BridgeMessage;
  return null;
}
