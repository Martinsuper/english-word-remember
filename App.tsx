import 'react-native-gesture-handler';
import { useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppState } from './src/hooks/useAppState';
import type { ReviewRating } from './src/types';

export default function App() {
  const app = useAppState();

  const reviewDetailWord = useCallback(
    (wordId: string, rating: ReviewRating) => {
      if (app.getTaskWordType(wordId)) {
        app.reviewTaskWord(wordId, rating);
      } else {
        app.reviewWord(wordId, rating);
      }
    },
    [app],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppNavigator app={app} reviewDetailWord={reviewDetailWord} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
