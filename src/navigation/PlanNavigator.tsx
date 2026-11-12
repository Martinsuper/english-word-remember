import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PlanStackParamList } from './types';
import { PlanScreen } from '../screens/PlanScreen';
import type { AppStateApi } from '../hooks/useAppState';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<PlanStackParamList>();

export function PlanNavigator({ app }: { app: AppStateApi }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Plan">
        {() => <PlanScreen app={app} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
