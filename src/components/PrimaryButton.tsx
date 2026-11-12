import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, pressedOpacity, radius } from '../theme';

type Variant = 'accent' | 'soft' | 'danger';

/** 全 App 统一的主按钮：accent 实心 / soft 描边 / danger 危险操作。 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = 'accent',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'accent' && styles.accent,
        variant === 'soft' && styles.soft,
        variant === 'danger' && styles.danger,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          variant === 'accent' && styles.accentLabel,
          variant === 'soft' && styles.softLabel,
          variant === 'danger' && styles.dangerLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  accent: { backgroundColor: colors.accent },
  soft: { borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.dangerMuted },
  accentLabel: { color: colors.accentInk, fontSize: 15, fontWeight: '700' },
  softLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  dangerLabel: { color: colors.dangerSoft, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: pressedOpacity },
  disabled: { opacity: 0.4 },
});
