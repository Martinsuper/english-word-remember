import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList, RootStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import type { AppStateApi } from '../hooks/useAppState';

const Stack = createNativeStackNavigator<HomeStackParamList>();

type RootNavProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeNavigator({ app }: { app: AppStateApi }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0b100e' },
      }}
    >
      <Stack.Screen name="Home">
        {() => <HomeScreenWrapper app={app} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function HomeScreenWrapper({ app }: { app: AppStateApi }) {
  const navigation = useNavigation<RootNavProp>();

  return (
    <HomeScreen
      app={app}
      onOpenStudy={() => navigation.navigate('Study')}
      onOpenWrong={() => navigation.navigate('WrongWords')}
      onOpenFavorites={() => {
        // Navigate to FavoritesTab and reset search
        app.setSearchQuery('');
      }}
      onOpenSettings={() => {
        app.setSearchQuery('');
      }}
      onStartAdvanced={() => {
        app.startAdvancedLearning();
        navigation.navigate('Study');
      }}
      onOpenWord={(wordId) => navigation.navigate('WordDetail', { wordId })}
    />
  );
}
