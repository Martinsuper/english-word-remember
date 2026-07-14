import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PlanStackParamList } from './types';
import { PlanScreen } from '../screens/PlanScreen';
import type { AppStateApi } from '../hooks/useAppState';

const Stack = createNativeStackNavigator<PlanStackParamList>();

export function PlanNavigator({ app }: { app: AppStateApi }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0b100e' },
      }}
    >
      <Stack.Screen name="Plan">
        {() => <PlanScreen app={app} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
