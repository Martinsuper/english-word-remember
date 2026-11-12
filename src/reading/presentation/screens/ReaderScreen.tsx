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
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookRepository } from '../../infrastructure/database/repositories/bookRepository';
import { progressRepository } from '../../infrastructure/database/repositories/progressRepository';
import { settingsRepository, ReaderSettings } from '../../infrastructure/database/repositories/settingsRepository';
import type { ReadingChapter, ReadingLocator } from '../../domain/models';
import type { ReadingStackParamList } from '../../../navigation/types';
import type { AppStateApi } from '../../../hooks/useAppState';
import { LookupSheet, LookupData } from '../components/LookupSheet';
import { RecallCoachModal } from '../components/RecallCoachModal';
import { isValidWordSelection, extractSentence } from '../../domain/wordSelection';

type NavProp = NativeStackNavigationProp<ReadingStackParamList>;

type BridgeMessage =
  | { type: 'READY'; chapterId: string }
  | { type: 'RESTORED'; chapterId: string }
  | { type: 'PROGRESS'; chapterId: string; progression: number }
  | { type: 'WORD_TAP'; word: string; contextBefore: string; contextAfter: string; progression: number }
  | { type: 'LINK_TAP'; href: string }
  | { type: 'RECALL_CONTEXT'; mode: 'paragraph' | 'chapter'; text: string }
  | { type: 'CONTROLS_TOGGLE' };

type ReaderColors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
};

const LIGHT_READER_COLORS: ReaderColors = {
  background: '#F5F0E6', surface: '#ECE5D8', border: '#D8CEBD', text: '#302E2A', muted: '#777168', accent: '#8A6336',
};
const DARK_READER_COLORS: ReaderColors = {
  background: '#171816', surface: '#21221F', border: '#343630', text: '#E7E3D9', muted: '#A8A49A', accent: '#C5A86A',
};

function getReaderColors(dark: boolean): ReaderColors {
  return dark ? DARK_READER_COLORS : LIGHT_READER_COLORS;
}

// 阅读器全部可变样式收敛为 CSS 变量：首次加载内联在 :root，之后改设置只注入脚本更新变量，
// 不再因字号/主题等变更重建 HTML 导致 WebView 整页 reload。
function readerStyleVariables(settings: ReaderSettings, dark: boolean): Record<string, string> {
  const colors = getReaderColors(dark);
  return {
    '--reader-bg': colors.background,
    '--reader-surface': colors.surface,
    '--reader-border': colors.border,
    '--reader-text': colors.text,
    '--reader-muted': colors.muted,
    '--reader-accent': colors.accent,
    '--reader-accent-soft': `${colors.accent}80`,
    '--reader-selection-bg': dark ? '#685936' : '#DFC58E',
    '--reader-font-size': `${settings.fontSize}px`,
    '--reader-line-height': String(settings.lineHeight),
    '--reader-pad-x': `${settings.marginSize}px`,
    '--reader-pad-top': `${settings.marginSize + 2}px`,
    '--reader-font-body': settings.fontFamily === 'serif'
      ? "Charter, 'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
      : "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
  };
}

function applyReaderStylePatch(settings: ReaderSettings, dark: boolean): string {
  const statements = Object.entries(readerStyleVariables(settings, dark))
    .map(([name, value]) => `root.style.setProperty('${name}', ${JSON.stringify(value)});`)
    .join(' ');
  return `(() => {
    const root = document.documentElement;
    ${statements}
  })(); true;`;
}

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
  const [recallContext, setRecallContext] = useState<{ mode: 'paragraph' | 'chapter'; text: string } | null>(null);
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>({
    fontSize: 18, lineHeight: 1.65, marginSize: 20, theme: 'dark', fontFamily: 'serif', tapLookupEnabled: true,
  });
  const webViewRef = useRef<WebView>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreLocatorRef = useRef<ReadingLocator | undefined>(initialLocator);
  const latestLocatorRef = useRef<ReadingLocator | undefined>(initialLocator);
  const restoringRef = useRef(Boolean(initialLocator));
  const dark = readerSettings.theme === 'system'
    ? systemColorScheme !== 'light'
    : readerSettings.theme === 'dark';
  const readerColors = getReaderColors(dark);

  // ref 镜像：注入样式补丁与桥接消息回调需要读到最新设置，而不必进入依赖数组。
  const webViewReadyRef = useRef(false);
  const currentChapterIndexRef = useRef(currentChapterIndex);
  currentChapterIndexRef.current = currentChapterIndex;
  const readerSettingsRef = useRef(readerSettings);
  readerSettingsRef.current = readerSettings;
  const darkRef = useRef(dark);
  darkRef.current = dark;

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
    // 设置变更不重载章节：样式通过 applyReaderStylePatch 注入更新（见下方 effect）。
  }, [chapters, currentChapterIndex]);

  useEffect(() => {
    if (!webViewReadyRef.current) return;
    webViewRef.current?.injectJavaScript(
      applyReaderStylePatch(readerSettingsRef.current, darkRef.current),
    );
  }, [readerSettings, dark]);

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
        restoringRef.current = true;
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

    webViewReadyRef.current = false;
    try {
      const html = await readAsStringAsync(chapter.extractedPath);
      // 快速连点切章时旧章节可能后返回，过期内容直接丢弃。
      if (index !== currentChapterIndexRef.current) return;
      const locator = restoreLocatorRef.current?.chapterId === chapter.id
        ? restoreLocatorRef.current
        : latestLocatorRef.current?.chapterId === chapter.id
          ? latestLocatorRef.current
          : undefined;
      restoringRef.current = Boolean(locator && (locator.progression ?? 0) > 0);
      const wrapped = wrapInReaderShell(html, chapter.id, locator);
      setChapterHtml(wrapped);
    } catch (error) {
      if (index !== currentChapterIndexRef.current) return;
      console.error('Failed to load chapter content:', error);
      setChapterHtml(wrapInReaderShell('<p>无法加载章节内容</p>', chapter.id));
    }
  };

  const wrapInReaderShell = (content: string, chapterId: string, locator?: ReadingLocator): string => {
    const cssVars = Object.entries(readerStyleVariables(readerSettings, dark))
      .map(([name, value]) => `${name}: ${value};`)
      .join('\n    ');
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
<style>
  :root {
    ${cssVars}
  }
  * { box-sizing: border-box; }
  html { background: var(--reader-bg); }
  body {
    font-family: var(--reader-font-body);
    font-size: var(--reader-font-size);
    line-height: var(--reader-line-height);
    letter-spacing: 0.006em;
    color: var(--reader-text);
    background-color: var(--reader-bg);
    padding: var(--reader-pad-top) var(--reader-pad-x) 40px;
    margin: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    hanging-punctuation: first last;
    -webkit-user-select: text;
    user-select: text;
  }
  body, body * { border-color: var(--reader-border); }
  img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.1em auto; display: block; }
  a { color: var(--reader-accent); text-decoration-color: var(--reader-accent-soft); text-underline-offset: 0.15em; }
  h1, h2, h3, h4, h5, h6 {
    color: var(--reader-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    letter-spacing: -0.018em;
    margin: 1.5em 0 0.65em;
    line-height: 1.25;
  }
  h1 { font-size: 1.65em; margin-top: 0.5em; }
  h2 { font-size: 1.38em; }
  h3 { font-size: 1.18em; }
  p { margin: 0 0 1em; }
  blockquote { border-left: 3px solid var(--reader-accent); padding: 0.15em 0 0.15em 1em; margin: 1.3em 0; color: var(--reader-muted); }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid var(--reader-border); padding: 0.6em; text-align: left; }
  th { background: var(--reader-surface); }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.38em 0; }
  hr { border: 0; border-top: 1px solid var(--reader-border); margin: 1.8em 0; }
  ::selection { background: var(--reader-selection-bg); color: var(--reader-text); }
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
  var restoring = restoreProgression > 0;
  var restoreObserver = null;
  function applyRestoredPosition() {
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, maxScroll * restoreProgression);
  }
  function finishRestore() {
    applyRestoredPosition();
    restoring = false;
    if (restoreObserver) restoreObserver.disconnect();
    post({ type: 'RESTORED', chapterId: '${chapterId}' });
    setTimeout(reportProgress, 50);
  }
  if (restoreProgression > 0) {
    [0, 60, 180, 400, 750].forEach(function(delay) {
      setTimeout(applyRestoredPosition, delay);
    });
    window.addEventListener('load', applyRestoredPosition, { once: true });
    if (window.ResizeObserver) {
      restoreObserver = new ResizeObserver(function() {
        if (restoring) applyRestoredPosition();
      });
      restoreObserver.observe(document.documentElement);
    }
    setTimeout(finishRestore, 1100);
  } else {
    setTimeout(function() {
      post({ type: 'RESTORED', chapterId: '${chapterId}' });
    }, 0);
  }

  var scrollTimer = null;
  var lastProgression = -1;
  function reportProgress() {
    if (restoring) return;
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
          webViewReadyRef.current = true;
          // 页面加载期间设置可能已变化，就绪时立即对齐一次最新样式。
          webViewRef.current?.injectJavaScript(
            applyReaderStylePatch(readerSettingsRef.current, darkRef.current),
          );
          break;
        case 'RESTORED':
          restoringRef.current = false;
          if (restoreLocatorRef.current?.chapterId === message.chapterId) {
            restoreLocatorRef.current = undefined;
          }
          break;
        case 'PROGRESS':
          scheduleSaveProgress(message.chapterId, message.progression);
          break;
        case 'WORD_TAP':
          handleWordTap(message.word, message.contextBefore, message.contextAfter, message.progression);
          break;
        case 'LINK_TAP':
          break;
        case 'RECALL_CONTEXT':
          if (message.text.trim()) setRecallContext({ mode: message.mode, text: message.text.trim() });
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
      saveTimerRef.current = null;
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
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const locator = latestLocatorRef.current?.chapterId === chapter.id
      ? latestLocatorRef.current
      : { chapterId: chapter.id, progression: 0 };
    const progression = locator.progression ?? 0;
    try {
      await progressRepository.saveProgress({
        bookId,
        locator,
        overallProgress: chapters.length > 0
          ? (currentChapterIndex + progression) / chapters.length
          : 0,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[reader] Failed to save progress before exit:', error);
    }
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
    settingsRepository.save(next).catch((error) => {
      console.warn('[reader] Failed to persist reader settings:', error);
    });
  };

  const requestRecallContext = (mode: 'paragraph' | 'chapter') => {
    setControlsVisible(false);
    const script = `(() => {
      const mode = ${JSON.stringify(mode)};
      let text = '';
      if (mode === 'chapter') {
        text = (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 12000);
      } else {
        const center = window.innerHeight / 2;
        const candidates = Array.from(document.querySelectorAll('p, li, blockquote'))
          .filter((element) => (element.textContent || '').trim().length >= 30);
        candidates.sort((a, b) => {
          const ar = a.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          return Math.abs((ar.top + ar.bottom) / 2 - center) - Math.abs((br.top + br.bottom) / 2 - center);
        });
        text = ((candidates[0] && candidates[0].textContent) || document.body.innerText || '')
          .replace(/\\s+/g, ' ').trim().slice(0, 5000);
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'RECALL_CONTEXT', mode, text }));
    })(); true;`;
    webViewRef.current?.injectJavaScript(script);
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
              <Ionicons name="chevron-back" size={14} color={readerColors.accent} />
              <Text style={[styles.menuActionText, { color: readerColors.accent }]}>返回</Text>
            </Pressable>
            <Text style={[styles.chapterTitle, { color: readerColors.text }]} numberOfLines={1}>
              {currentChapter?.title || `Chapter ${currentChapterIndex + 1}`}
            </Text>
            <Pressable onPress={toggleControls} style={[styles.menuActionButton, { backgroundColor: readerColors.surface }]}>
              <Text style={[styles.menuActionText, { color: readerColors.accent }]}>收起</Text>
            </Pressable>
          </View>

          <View style={styles.settingsGrid}>
            <ReaderSettingButton glyph="A−" label="字号" onPress={() => updateReaderSettings({ fontSize: Math.max(14, readerSettings.fontSize - 2) })} color={readerColors} />
            <ReaderSettingButton glyph="A＋" label="字号" onPress={() => updateReaderSettings({ fontSize: Math.min(30, readerSettings.fontSize + 2) })} color={readerColors} />
            <ReaderSettingButton icon={dark ? 'sunny-outline' : 'moon-outline'} label={dark ? '日间模式' : '夜间模式'} onPress={() => updateReaderSettings({ theme: dark ? 'light' : 'dark' })} color={readerColors} />
            <ReaderSettingButton icon="menu-outline" label="行距" onPress={() => updateReaderSettings({ lineHeight: readerSettings.lineHeight >= 2.1 ? 1.3 : Math.round((readerSettings.lineHeight + 0.2) * 10) / 10 })} color={readerColors} />
            <ReaderSettingButton icon="text-outline" label="字体" onPress={() => updateReaderSettings({ fontFamily: readerSettings.fontFamily === 'serif' ? 'sans-serif' : 'serif' })} color={readerColors} />
            <ReaderSettingButton icon={readerSettings.tapLookupEnabled ? 'search' : 'search-outline'} label={readerSettings.tapLookupEnabled ? '查词·开' : '查词·关'} onPress={() => updateReaderSettings({ tapLookupEnabled: !readerSettings.tapLookupEnabled })} color={readerColors} />
            <ReaderSettingButton icon="sparkles-outline" label="段落回忆" onPress={() => requestRecallContext('paragraph')} color={readerColors} />
            <ReaderSettingButton icon="document-text-outline" label="章节复述" onPress={() => requestRecallContext('chapter')} color={readerColors} />
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
      <RecallCoachModal
        visible={recallContext !== null}
        mode={recallContext?.mode ?? 'paragraph'}
        passage={recallContext?.text ?? ''}
        onClose={() => setRecallContext(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b100e' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chapterTitle: { flex: 1, color: '#f7f8f3', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  webviewContainer: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#0b100e' },
  collapsedMenuButton: { position: 'absolute', alignSelf: 'center', zIndex: 20, minWidth: 124, height: 40, paddingHorizontal: 18, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  readerMenuButtonText: { fontSize: 15, lineHeight: 18, fontWeight: '700' },
  menuActionText: { fontSize: 13, fontWeight: '600', marginLeft: 1 },
  bottomMenu: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, paddingTop: 10, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  menuTitleRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  menuActionButton: { flexDirection: 'row', gap: 2, minWidth: 64, minHeight: 34, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 7, marginBottom: 10 },
  settingButton: { width: '23.5%', minHeight: 52, paddingVertical: 7, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4 },
  settingGlyph: { fontSize: 17, fontWeight: '700', lineHeight: 20 },
  settingLabel: { fontSize: 10, fontWeight: '500' },
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
  navButtonText: { color: '#a3e635', fontWeight: '600', fontSize: 13 },
  chapterIndicator: { color: '#829087', fontSize: 13 },
});

/** 阅读菜单设置按钮：图标/字形 + 短标签，颜色跟随阅读器主题。 */
function ReaderSettingButton({
  icon,
  glyph,
  label,
  onPress,
  color,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  glyph?: string;
  label: string;
  onPress: () => void;
  color: ReaderColors;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.settingButton, { backgroundColor: color.surface }, pressed && { opacity: 0.75 }]}
    >
      {glyph ? (
        <Text style={[styles.settingGlyph, { color: color.accent }]}>{glyph}</Text>
      ) : icon ? (
        <Ionicons name={icon} size={17} color={color.accent} />
      ) : null}
      <Text style={[styles.settingLabel, { color: color.muted }]}>{label}</Text>
    </Pressable>
  );
}

function parseBridgeMessage(raw: string): BridgeMessage | null {
  const value = JSON.parse(raw) as Record<string, unknown>;
  if (typeof value.type !== 'string') return null;
  // 这四类消息不携带 chapterId；其余类型必须携带，避免优先级歧义。
  const chapterIdOptional =
    value.type === 'WORD_TAP' ||
    value.type === 'LINK_TAP' ||
    value.type === 'RECALL_CONTEXT' ||
    value.type === 'CONTROLS_TOGGLE';
  if (!chapterIdOptional && typeof value.chapterId !== 'string') return null;
  if (value.type === 'READY' && typeof value.chapterId === 'string') return value as BridgeMessage;
  if (value.type === 'RESTORED' && typeof value.chapterId === 'string') return value as BridgeMessage;
  if (value.type === 'PROGRESS' && typeof value.chapterId === 'string' && typeof value.progression === 'number' && value.progression >= 0 && value.progression <= 1) return value as BridgeMessage;
  if (value.type === 'WORD_TAP' && typeof value.word === 'string' && value.word.length <= 80 && typeof value.contextBefore === 'string' && value.contextBefore.length <= 1000 && typeof value.contextAfter === 'string' && value.contextAfter.length <= 1000 && typeof value.progression === 'number') return value as BridgeMessage;
  if (value.type === 'LINK_TAP' && typeof value.href === 'string' && value.href.length <= 2048) return value as BridgeMessage;
  if (value.type === 'RECALL_CONTEXT' && (value.mode === 'paragraph' || value.mode === 'chapter') && typeof value.text === 'string' && value.text.length <= 15000) return value as BridgeMessage;
  if (value.type === 'CONTROLS_TOGGLE') return value as BridgeMessage;
  return null;
}
