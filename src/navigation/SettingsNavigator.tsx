import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from './types';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { AppStateApi } from '../hooks/useAppState';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsNavigator({ app }: { app: AppStateApi }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0b100e' },
      }}
    >
      <Stack.Screen name="Settings">
        {() => <SettingsScreen app={app} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
