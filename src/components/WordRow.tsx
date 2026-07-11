import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DeckEntry } from '../types';
import { isDue } from '../domain/review';

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151c18',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#263129',
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
    color: '#f1f4ee',
    fontSize: 16,
    fontWeight: '800',
  },
  meaning: {
    color: '#829087',
    fontSize: 13,
    marginTop: 3,
  },
  meta: {
    color: '#aab5ad',
    fontSize: 12,
    fontWeight: '700',
  },
  statusDot: { width: 7, height: 7, borderRadius: 999 },
  dueDot: { backgroundColor: '#a3e635' },
  doneDot: { backgroundColor: '#4b5a50' },
  pressed: {
    opacity: 0.75,
  },
});
