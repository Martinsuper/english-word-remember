import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/** 统计块：value + label。light 用于亮色 hero 卡内部，dark 用于常规深色卡。 */
export function StatCard({
  value,
  label,
  tone = 'dark',
}: {
  value: string;
  label: string;
  tone?: 'dark' | 'light';
}) {
  const onLight = tone === 'light';
  return (
    <View style={styles.container}>
      <Text style={[styles.value, onLight && styles.valueLight]}>{value}</Text>
      <Text style={[styles.label, onLight && styles.labelLight]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', gap: 3 },
  value: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  valueLight: { color: colors.accentInk },
  label: { color: colors.textTertiary, fontSize: 12, fontWeight: '500' },
  labelLight: { color: colors.accentDeep },
});
