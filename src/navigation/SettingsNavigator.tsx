import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from './types';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { AppStateApi } from '../hooks/useAppState';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsNavigator({ app }: { app: AppStateApi }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Settings">
        {() => <SettingsScreen app={app} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
