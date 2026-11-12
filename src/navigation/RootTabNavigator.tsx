import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from './types';
import { MainTabBar } from './MainTabBar';
import { HomeNavigator } from './HomeNavigator';
import { ReadingNavigator } from './ReadingNavigator';
import { PlanNavigator } from './PlanNavigator';
import { FavoritesNavigator } from './FavoritesNavigator';
import { SettingsNavigator } from './SettingsNavigator';
import type { AppStateApi } from '../hooks/useAppState';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootTabNavigator({ app }: { app: AppStateApi }) {
  return (
    <Tab.Navigator
      tabBar={(props) => <MainTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab">
        {() => <HomeNavigator app={app} />}
      </Tab.Screen>
      <Tab.Screen name="ReadingTab">
        {() => <ReadingNavigator app={app} />}
      </Tab.Screen>
      <Tab.Screen name="PlanTab">
        {() => <PlanNavigator app={app} />}
      </Tab.Screen>
      <Tab.Screen name="FavoritesTab">
        {() => <FavoritesNavigator app={app} />}
      </Tab.Screen>
      <Tab.Screen name="SettingsTab">
        {() => <SettingsNavigator app={app} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
