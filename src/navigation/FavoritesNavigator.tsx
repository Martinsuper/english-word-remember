import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FavoritesStackParamList, RootStackParamList } from './types';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import type { AppStateApi } from '../hooks/useAppState';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<FavoritesStackParamList>();

type RootNavProp = NativeStackNavigationProp<RootStackParamList>;

export function FavoritesNavigator({ app }: { app: AppStateApi }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Favorites">
        {() => <FavoritesScreenWrapper app={app} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function FavoritesScreenWrapper({ app }: { app: AppStateApi }) {
  const navigation = useNavigation<RootNavProp>();

  return (
    <FavoritesScreen
      app={app}
      onOpenWord={(wordId) => navigation.navigate('WordDetail', { wordId })}
    />
  );
}
