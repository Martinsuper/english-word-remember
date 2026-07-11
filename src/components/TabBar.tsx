import { Pressable, StyleSheet, Text, View } from 'react-native';

export type TabItem = { key: string; label: string; shortLabel?: string };

export function TabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tab: string) => void;
}) {
  return (
    <View style={styles.shell}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}
            >
              <Text style={[styles.index, active && styles.activeIndex]}>{tab.shortLabel}</Text>
              <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
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
