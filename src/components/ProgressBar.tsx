import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

/** 全 App 统一的进度条：默认高 6、圆角胶囊。亮底（hero 卡）上传入浅色 track。 */
export function ProgressBar({
  progress,
  height = 6,
  trackColor = colors.border,
  fillColor = colors.accent,
  style,
}: {
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: ViewStyle;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View
      accessibilityRole="progressbar"
      style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height / 2 }, style]}
    >
      <View
        style={[
          styles.fill,
          { width: `${Math.max(clamped > 0 ? 0.04 : 0, clamped) * 100}%`, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
