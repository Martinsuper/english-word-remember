import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, pressedOpacity, radius } from '../theme';

type Tone = 'danger' | 'warning' | 'success';

const TONE_COLORS: Record<Tone, string> = {
  danger: colors.danger,
  warning: colors.warning,
  success: colors.accent,
};

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
      <View style={[styles.marker, { backgroundColor: TONE_COLORS[tone] }]} />
      <Text style={styles.label}>{label}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 72,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  marker: { width: 20, height: 3, borderRadius: 999, marginBottom: 6 },
  label: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  helper: { color: colors.textTertiary, fontSize: 10, fontWeight: '500', marginTop: 2 },
  pressed: { opacity: pressedOpacity },
});
