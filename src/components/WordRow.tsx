import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DeckEntry } from '../types';
import { isDue } from '../domain/review';
import { colors, pressedOpacity, radius } from '../theme';

export function WordRow({
  entry,
  rightLabel,
  onPress,
}: {
  entry: DeckEntry;
  rightLabel?: string;
  onPress?: () => void;
}) {
  const due = isDue(entry);
  const Content = (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.term}>{entry.term}</Text>
        <Text style={styles.meaning}>{entry.meaning}</Text>
      </View>
      <View style={styles.right}>
        {rightLabel ? <Text style={styles.meta}>{rightLabel}</Text> : null}
        <View style={[styles.statusDot, due ? styles.dueDot : styles.doneDot]} />
      </View>
    </View>
  );

  if (!onPress) {
    return <View style={styles.card}>{Content}</View>;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {Content}
    </Pressable>
  );
}

// 注意：卡片自身不带外边距，列表间距由父级容器 gap / FlatList separator 控制。

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  left: {
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  term: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  meaning: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  statusDot: { width: 7, height: 7, borderRadius: 999 },
  dueDot: { backgroundColor: colors.accent },
  doneDot: { backgroundColor: colors.textTertiary },
  pressed: {
    opacity: pressedOpacity,
  },
});
