import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ReaderPlaceholderScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>📖</Text>
        <Text style={styles.title}>阅读器</Text>
        <Text style={styles.subtitle}>即将完成，敬请期待</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b100e' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: '#f7f8f3', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: '#829087', fontSize: 16 },
});
