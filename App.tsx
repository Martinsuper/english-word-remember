import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SearchBar } from './src/components/SearchBar';
import { TabBar } from './src/components/TabBar';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StudyScreen } from './src/screens/StudyScreen';
import { WordDetailScreen } from './src/screens/WordDetailScreen';
import { WrongWordsScreen } from './src/screens/WrongWordsScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { useAppState } from './src/hooks/useAppState';
import { ReviewRating } from './src/types';

type MainScreen = 'home' | 'favorites' | 'plan' | 'settings';
type ScreenKey = MainScreen | 'wrong' | 'study' | 'detail';

const tabs: { key: MainScreen; label: string; shortLabel: string }[] = [
  { key: 'home', label: '今日', shortLabel: '01' },
  { key: 'plan', label: '计划', shortLabel: '02' },
  { key: 'favorites', label: '收藏', shortLabel: '03' },
  { key: 'settings', label: '我的', shortLabel: '04' },
];

const screenTitles: Record<'wrong' | Exclude<MainScreen, 'home'>, { eyebrow: string; title: string }> = {
  wrong: { eyebrow: 'REVIEW', title: '薄弱词' },
  plan: { eyebrow: 'STUDY PLAN', title: '学习计划' },
  favorites: { eyebrow: 'SAVED', title: '收藏' },
  settings: { eyebrow: 'PREFERENCES', title: '我的学习' },
};

export default function App() {
  const app = useAppState();
  const [screen, setScreen] = useState<ScreenKey>('home');
  const [backScreen, setBackScreen] = useState<ScreenKey>('home');
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);

  const openWord = (wordId: string) => {
    setSelectedWordId(wordId);
    setBackScreen(screen === 'detail' ? backScreen : screen);
    setScreen('detail');
  };

  const closeDetail = () => setScreen(backScreen);

  const reviewDetailWord = (wordId: string, rating: ReviewRating) => {
    if (backScreen !== 'study') {
      if (app.getTaskWordType(wordId)) {
        app.reviewTaskWord(wordId, rating);
      } else {
        app.reviewWord(wordId, rating);
      }
      return;
    }

    const queue = app.reviewQueue;
    const currentIndex = queue.findIndex((entry) => entry.id === wordId);
    const nextWord = queue[currentIndex + 1] ?? queue.find((entry) => entry.id !== wordId);
    app.reviewWord(wordId, rating);

    if (nextWord) {
      setSelectedWordId(nextWord.id);
      setBackScreen('study');
      return;
    }
    setScreen('study');
  };

  const isMainScreen = screen === 'home' || screen === 'plan' || screen === 'favorites' || screen === 'settings';
  const showListHeader = screen === 'plan' || screen === 'favorites' || screen === 'wrong' || screen === 'settings';
  const showSearch = screen === 'favorites' || screen === 'wrong';

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safeArea}>
      {showListHeader ? (
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{screenTitles[screen].eyebrow}</Text>
            <Text style={styles.screenTitle}>{screenTitles[screen].title}</Text>
          </View>
          <View style={styles.deckBadge}>
            <Text style={styles.deckBadgeValue}>{app.state.deck.length}</Text>
            <Text style={styles.deckBadgeLabel}>词</Text>
          </View>
        </View>
      ) : null}

      {showSearch ? (
        <SearchBar value={app.state.searchQuery} onChange={app.setSearchQuery} onClear={() => app.setSearchQuery('')} />
      ) : null}

      <View style={styles.content}>
        {screen === 'home' ? (
          <HomeScreen
            app={app}
            onOpenStudy={() => setScreen('study')}
            onOpenWrong={() => setScreen('wrong')}
            onOpenFavorites={() => setScreen('favorites')}
            onOpenSettings={() => setScreen('settings')}
            onStartAdvanced={() => {
              app.startAdvancedLearning();
              setScreen('study');
            }}
            onOpenWord={openWord}
          />
        ) : null}

        {screen === 'study' ? (
          <StudyScreen app={app} onExit={() => setScreen('home')} />
        ) : null}
        {screen === 'favorites' ? <FavoritesScreen app={app} onOpenWord={openWord} /> : null}
        {screen === 'plan' ? <PlanScreen app={app} /> : null}
        {screen === 'wrong' ? <WrongWordsScreen app={app} onOpenWord={openWord} /> : null}
        {screen === 'settings' ? <SettingsScreen app={app} /> : null}
        {screen === 'detail' && selectedWordId ? (
          <WordDetailScreen
            app={app}
            wordId={selectedWordId}
            onBack={closeDetail}
            onSpeakWord={app.speakWord}
            onReviewWord={reviewDetailWord}
          />
        ) : null}
      </View>

      {isMainScreen ? (
        <TabBar
          tabs={tabs}
          activeTab={screen}
          onChange={(tab) => {
            app.setSearchQuery('');
            setScreen(tab as MainScreen);
          }}
        />
      ) : null}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0b100e' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: { color: '#a3e635', fontSize: 11, letterSpacing: 2, fontWeight: '900' },
  screenTitle: { color: '#f7f8f3', fontSize: 28, fontWeight: '900', marginTop: 4 },
  deckBadge: {
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#151c18',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#263129',
  },
  deckBadgeValue: { color: '#f7f8f3', fontSize: 16, fontWeight: '900' },
  deckBadgeLabel: { color: '#829087', fontSize: 11, fontWeight: '700' },
  content: { flex: 1 },
});
