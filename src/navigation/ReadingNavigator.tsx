import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LibraryScreen } from '../reading/presentation/screens/LibraryScreen';
import { BookDetailScreen } from '../reading/presentation/screens/BookDetailScreen';
import { ReaderScreen } from '../reading/presentation/screens/ReaderScreen';
import type { ReadingStackParamList } from './types';
import type { AppStateApi } from '../hooks/useAppState';

const Stack = createNativeStackNavigator<ReadingStackParamList>();

export function ReadingNavigator({ app }: { app: AppStateApi }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0b100e' },
      }}
    >
      <Stack.Screen name="Library" component={LibraryScreen} />
      <Stack.Screen name="BookDetail" component={BookDetailScreen} />
      <Stack.Screen name="Reader">
        {() => <ReaderScreen app={app} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
