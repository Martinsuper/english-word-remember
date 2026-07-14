import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

const tabDefs: { key: string; label: string; shortLabel: string }[] = [
  { key: 'HomeTab', label: '今日', shortLabel: '01' },
  { key: 'ReadingTab', label: '阅读', shortLabel: '02' },
  { key: 'PlanTab', label: '计划', shortLabel: '03' },
  { key: 'FavoritesTab', label: '收藏', shortLabel: '04' },
  { key: 'SettingsTab', label: '我的', shortLabel: '05' },
];

export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const focusedRoute = state.routes[state.index];
  const focusedNestedRoute = getFocusedRouteNameFromRoute(focusedRoute);

  // The reader has its own theme-aware controls and needs the full screen.
  // Keeping the app-wide dark tab bar visible breaks light reader themes.
  if (focusedRoute.name === 'ReadingTab' && focusedNestedRoute === 'Reader') {
    return null;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tabDef = tabDefs[index] || { key: route.name, label: route.name, shortLabel: '??' };

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
              style={({ pressed }) => [styles.tab, isFocused && styles.activeTab, pressed && styles.pressed]}
            >
              <Text style={[styles.index, isFocused && styles.activeIndex]}>{tabDef.shortLabel}</Text>
              <Text style={[styles.label, isFocused && styles.activeLabel]}>{tabDef.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: '#0b100e', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 },
  bar: {
    flexDirection: 'row',
    padding: 5,
    borderRadius: 22,
    backgroundColor: '#151c18',
    borderWidth: 1,
    borderColor: '#263129',
  },
  tab: { flex: 1, minHeight: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 2 },
  activeTab: { backgroundColor: '#eef7d5' },
  index: { color: '#637168', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  activeIndex: { color: '#566b17' },
  label: { color: '#aab5ad', fontWeight: '800', fontSize: 12 },
  activeLabel: { color: '#172009' },
  pressed: { opacity: 0.72 },
});
