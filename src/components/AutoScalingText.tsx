import { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

type Props = TextProps & {
  minimumFontScale?: number;
};

/**
 * A Text component that automatically shrinks its font size to fit within
 * the container width on a single line. Works on both iOS and Android.
 *
 * On iOS, this delegates to the native `adjustsFontSizeToFit` behavior when
 * no `minimumFontScale` customization is needed (for best performance).
 * On Android, it measures text width via `onTextLayout` and scales down
 * the font size proportionally.
 */
export function AutoScalingText({
  style,
  children,
  minimumFontScale = 0.4,
  numberOfLines = 1,
  adjustsFontSizeToFit,
  ...rest
}: Props & { adjustsFontSizeToFit?: boolean }) {
  const [scale, setScale] = useState(1);
  const containerWidthRef = useRef(0);

  const flatStyle = StyleSheet.flatten(style) ?? {};
  const baseFontSize = (flatStyle.fontSize as number) ?? 14;

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    containerWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  const onTextLayout = useCallback(
    (e: { nativeEvent: { lines: Array<{ width: number }> } }) => {
      if (Platform.OS === 'ios') return;
      const lines = e.nativeEvent.lines;
      if (!lines?.length) return;

      const currentFontSize = baseFontSize * scale;
      const measuredWidth = lines[0].width;
      // Extrapolate text width at the base font size (roughly linear)
      const widthAtBase = measuredWidth * (baseFontSize / currentFontSize);
      const available = containerWidthRef.current;

      if (available > 0 && widthAtBase > available) {
        const next = Math.max(minimumFontScale, available / widthAtBase);
        setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
      } else if (scale < 1 && widthAtBase <= available) {
        setScale(1);
      }
    },
    [baseFontSize, minimumFontScale, scale],
  );

  // On iOS, prefer the native adjustsFontSizeToFit (zero-flash).
  // On Android, apply the computed font size manually.
  const iosProps =
    Platform.OS === 'ios' && adjustsFontSizeToFit
      ? { adjustsFontSizeToFit: true, minimumFontScale }
      : {};

  const androidStyle =
    Platform.OS === 'android' ? { fontSize: baseFontSize * scale } : undefined;

  return (
    <Text
      {...rest}
      {...iosProps}
      numberOfLines={numberOfLines}
      onLayout={onLayout}
      onTextLayout={onTextLayout}
      style={[style, androidStyle]}
    >
      {children}
    </Text>
  );
}
