import { NavigationContainer } from '@react-navigation/native';
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator({
  app,
  reviewDetailWord,
}: {
  app: AppStateApi;
  reviewDetailWord: (wordId: string, rating: ReviewRating) => void;
}) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0b100e' },
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
  );
}
