import { NavigationContainer, Theme as NavigationTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { RootTabNavigator } from './RootTabNavigator';
import { StudyScreen } from '../screens/StudyScreen';
import { WrongWordsScreen } from '../screens/WrongWordsScreen';
import { WordDetailScreen } from '../screens/WordDetailScreen';
import type { AppStateApi } from '../hooks/useAppState';
import type { ReviewRating } from '../types';
import { wordContextRepository } from '../reading/infrastructure/database/repositories/wordContextRepository';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors as themeColors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: NavigationTheme = {
  dark: true,
  colors: {
    primary: themeColors.accent,
    background: themeColors.bg,
    card: themeColors.surface,
    text: themeColors.textPrimary,
    border: themeColors.border,
    notification: themeColors.accent,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '800' },
  },
};

export function AppNavigator({
  app,
  reviewDetailWord,
}: {
  app: AppStateApi;
  reviewDetailWord: (wordId: string, rating: ReviewRating) => void;
}) {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: themeColors.bg },
          }}
        >
        <Stack.Screen name="MainTabs">
          {() => <RootTabNavigator app={app} />}
        </Stack.Screen>
        <Stack.Screen name="Study">
          {({ navigation }) => (
            <StudyScreen app={app} onExit={() => navigation.goBack()} />
          )}
        </Stack.Screen>
        <Stack.Screen name="WrongWords">
          {({ navigation }) => (
            <WrongWordsScreen
              app={app}
              onOpenWord={(wordId) => navigation.navigate('WordDetail', { wordId })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="WordDetail">
          {({ route, navigation }) => (
            <WordDetailScreen
              app={app}
              wordId={route.params.wordId}
              onBack={() => navigation.goBack()}
              onSpeakWord={app.speakWord}
              onReviewWord={reviewDetailWord}
              onOpenSource={async () => {
                const contexts = await wordContextRepository.findByWordId(route.params.wordId);
                const source = contexts.find((context) => Boolean(context.bookId)) ?? contexts[0];
                if (!source?.bookId) {
                  Alert.alert('原文不可用', '这本书已经从本地书库删除，但保存的原句仍然保留。');
                  return;
                }
                navigation.navigate('MainTabs', {
                  screen: 'ReadingTab',
                  params: {
                    screen: 'Reader',
                    params: { bookId: source.bookId, locator: source.locator },
                  },
                });
              }}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
