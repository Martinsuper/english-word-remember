import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type TabIconName =
  | 'home-outline'
  | 'home'
  | 'book-outline'
  | 'book'
  | 'calendar-outline'
  | 'calendar'
  | 'star-outline'
  | 'star'
  | 'person-outline'
  | 'person';

const tabDefs: { key: string; label: string; icon: TabIconName; activeIcon: TabIconName }[] = [
  { key: 'HomeTab', label: '今日', icon: 'home-outline', activeIcon: 'home' },
  { key: 'ReadingTab', label: '阅读', icon: 'book-outline', activeIcon: 'book' },
  { key: 'PlanTab', label: '计划', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'FavoritesTab', label: '收藏', icon: 'star-outline', activeIcon: 'star' },
  { key: 'SettingsTab', label: '我的', icon: 'person-outline', activeIcon: 'person' },
];

export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const focusedRoute = state.routes[state.index];
  const focusedNestedRoute = getFocusedRouteNameFromRoute(focusedRoute);

  // The reader has its own theme-aware controls and needs the full screen.
  // Keeping the app-wide dark tab bar visible breaks light reader themes.
  if (focusedRoute.name === 'ReadingTab' && focusedNestedRoute === 'Reader') {
    return null;
  }

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(10, insets.bottom) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tabDef =
            tabDefs[index] || { key: route.name, label: route.name, icon: 'home-outline' as TabIconName, activeIcon: 'home' as TabIconName };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Ionicons
                name={isFocused ? tabDef.activeIcon : tabDef.icon}
                size={22}
                color={isFocused ? colors.accent : colors.textTertiary}
              />
              <Text style={[styles.label, isFocused && styles.activeLabel]}>{tabDef.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: colors.bg, paddingHorizontal: 12, paddingTop: 8 },
  bar: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { color: colors.textTertiary, fontWeight: '500', fontSize: 10 },
  activeLabel: { color: colors.accent, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
