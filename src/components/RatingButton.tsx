import { Pressable, StyleSheet, Text, View } from 'react-native';

type Tone = 'danger' | 'warning' | 'success';

export function RatingButton({
  label,
  helper,
  tone,
  onPress,
}: {
  label: string;
  helper?: string;
  tone: Tone;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.marker,
          tone === 'danger' && styles.danger,
          tone === 'warning' && styles.warning,
          tone === 'success' && styles.success,
        ]}
      />
      <Text style={styles.label}>{label}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 76,
    backgroundColor: '#151c18',
    borderWidth: 1,
    borderColor: '#2b362e',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
  },
  marker: { width: 22, height: 3, borderRadius: 999, marginBottom: 9 },
  danger: { backgroundColor: '#fb7185' },
  warning: { backgroundColor: '#facc15' },
  success: { backgroundColor: '#a3e635' },
  label: { color: '#eef2ee', fontSize: 13, fontWeight: '900' },
  helper: { color: '#768279', fontSize: 9, fontWeight: '700', marginTop: 3 },
  pressed: { opacity: 0.7 },
});
