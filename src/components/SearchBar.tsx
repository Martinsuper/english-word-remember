import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function SearchBar({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) {
        onChangeRef.current(draft);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [draft, value]);

  const clear = () => {
    setDraft('');
    onClear();
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="搜索单词或释义"
        placeholderTextColor="#66736b"
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {draft ? (
        <Pressable onPress={clear} style={styles.clearButton}>
          <Text style={styles.clearText}>清除</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#0b100e',
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#151c18',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f4ee',
    borderWidth: 1,
    borderColor: '#263129',
  },
  clearButton: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#263129',
  },
  clearText: {
    color: '#d9e1db',
    fontWeight: '700',
  },
});
