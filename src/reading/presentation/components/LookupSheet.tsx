import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import type { ReadingLocator } from '../../domain/models';
import { normalizeWord } from '../../domain/wordSelection';
import { addReadingWord } from '../../application/addReadingVocabulary';
import type { AppStateApi } from '../../../hooks/useAppState';
import { lookupLocalWord } from '../../domain/localDictionary';
import { lookupFreeDictionary, OnlineDictionaryEntry } from '../../infrastructure/dictionary/freeDictionaryProvider';
import { lookupExamDictionary } from '../../infrastructure/dictionary/examDictionary';
import { lookupOnlineTranslation, OnlineTranslationEntry } from '../../infrastructure/dictionary/onlineTranslationProvider';
import { lookupEcdict, EcdictEntry } from '../../infrastructure/dictionary/ecdictProvider';

export type LookupData = {
  word: string;
  sentence: string;
  bookId: string;
  chapterId: string;
  locator: ReadingLocator;
};

type LookupSheetProps = {
  visible: boolean;
  data: LookupData | null;
  app: AppStateApi;
  onClose: () => void;
  bookTitle: string;
};

export function LookupSheet({ visible, data, app, onClose, bookTitle }: LookupSheetProps) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [onlineEntry, setOnlineEntry] = useState<OnlineDictionaryEntry | null>(null);
  const [onlineTranslation, setOnlineTranslation] = useState<OnlineTranslationEntry | null>(null);
  const [ecdictEntry, setEcdictEntry] = useState<EcdictEntry | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);

  const queryWord = data?.word ?? '';
  const normalized = normalizeWord(queryWord);
  const dictionaryMatch = useMemo(
    () => lookupLocalWord(app.availablePacks, queryWord),
    [app.availablePacks, queryWord],
  );
  const localWord = dictionaryMatch?.word;
  const examEntry = useMemo(() => lookupExamDictionary(queryWord), [queryWord]);
  const tags = examEntry?.tags ?? localWord?.tags ?? ecdictEntry?.tags ?? [];
  const resolvedPhonetic = localWord?.phonetic || examEntry?.phonetic || ecdictEntry?.phonetic || onlineEntry?.phonetic || '';
  const resolvedMeaning = localWord?.meaning || examEntry?.meaning || ecdictEntry?.meaning || onlineTranslation?.meaning || onlineEntry?.meaning || '';

  useEffect(() => {
    setOnlineEntry(null);
    setOnlineTranslation(null);
    setEcdictEntry(null);
    if (!visible || localWord || examEntry) {
      setOnlineLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setOnlineLoading(true);
    (async () => {
      const offline = await lookupEcdict(normalized);
      if (!active) return;
      setEcdictEntry(offline);
      if (offline) return;
      const [translation, dictionary] = await Promise.all([
        lookupOnlineTranslation(normalized, controller.signal),
        lookupFreeDictionary(normalized, controller.signal),
      ]);
      if (!active) return;
      setOnlineTranslation(translation);
      setOnlineEntry(dictionary);
    })().finally(() => {
      if (active) setOnlineLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [normalized, visible, Boolean(localWord), Boolean(examEntry)]);

  if (!data) return null;

  const handleAdd = async () => {
    if (adding) return;
    setAdding(true);

    try {
      const wordId = app.upsertReadingWord({
        term: data.word,
        phonetic: resolvedPhonetic,
        meaning: resolvedMeaning,
        tags,
        sentence: data.sentence,
        sourceBook: bookTitle,
      });
      const result = await addReadingWord({
        wordId,
        surfaceForm: data.word,
        sentence: data.sentence,
        bookId: data.bookId,
        chapterId: data.chapterId,
        locator: data.locator,
      });

      switch (result.status) {
        case 'created':
          setResultMessage('已加入阅读生词');
          setAdded(true);
          break;
        case 'context_added':
          setResultMessage('已补充语境');
          setAdded(true);
          break;
        case 'already_exists':
          setResultMessage('此语境已存在');
          setAdded(true);
          break;
      }
    } catch (error) {
      console.error('Failed to add word:', error);
      setResultMessage('加入失败，请重试');
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setAdded(false);
    setResultMessage('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View />
      </Pressable>
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.wordRow}>
          <Text style={styles.word}>{data.word}</Text>
          <Text style={styles.normalized}>({normalized})</Text>
        </View>

        <Pressable onPress={() => app.speakWord(data.word)} style={styles.speakButton}>
          <Text style={styles.speakButtonText}>🔊 美式发音</Text>
        </Pressable>

        {localWord || examEntry || ecdictEntry ? (
          <View style={styles.localInfo}>
            <Text style={styles.onlineLabel}>{ecdictEntry && !localWord && !examEntry ? 'ECDICT 完整离线词典' : '离线英汉词典'}</Text>
            {normalizeWord(localWord?.term ?? examEntry?.term ?? ecdictEntry?.term ?? '') !== normalized ? (
              <Text style={styles.matchedTerm}>原形：{localWord?.term ?? examEntry?.term ?? ecdictEntry?.term}</Text>
            ) : null}
            {tags.length > 0 ? (
              <View style={styles.tagRow}>
                {tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
              </View>
            ) : null}
            {resolvedPhonetic ? <Text style={styles.phonetic}>/{resolvedPhonetic.replace(/^\/|\/$/g, '')}/</Text> : null}
            <Text style={styles.meaning}>{resolvedMeaning}</Text>
            {ecdictEntry?.englishDefinition ? <Text style={styles.englishMeaning}>{ecdictEntry.englishDefinition}</Text> : null}
          </View>
        ) : onlineTranslation || onlineEntry ? (
          <View style={styles.localInfo}>
            <Text style={styles.onlineLabel}>{onlineTranslation ? '在线英汉翻译' : '在线英英释义'}</Text>
            {onlineEntry?.phonetic ? <Text style={styles.phonetic}>{onlineEntry.phonetic}</Text> : null}
            <Text style={styles.meaning}>{onlineTranslation?.meaning ?? onlineEntry?.meaning}</Text>
            {onlineTranslation && onlineEntry ? <Text style={styles.englishMeaning}>{onlineEntry.meaning}</Text> : null}
          </View>
        ) : (
          <View style={styles.localInfo}>
            <Text style={styles.noEntry}>{onlineLoading ? '正在查询释义…' : '暂未找到释义'}</Text>
          </View>
        )}

        <View style={styles.sentenceBox}>
          <Text style={styles.sentenceLabel}>原文语境</Text>
          <Text style={styles.sentence}>{data.sentence}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleClose}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>关闭</Text>
          </Pressable>

          {added ? (
            <View style={styles.addedBadge}>
              <Text style={styles.addedText}>{resultMessage}</Text>
            </View>
          ) : (
            <Pressable
              onPress={handleAdd}
              disabled={adding}
              style={({ pressed }) => [
                styles.addButton,
                adding && styles.addButtonDisabled,
                pressed && styles.addButtonPressed,
              ]}
            >
              {adding ? (
                <ActivityIndicator size="small" color="#0b100e" />
              ) : (
                <Text style={styles.addButtonText}>加入阅读生词</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#151c18',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#263129',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a4a40',
    alignSelf: 'center',
    marginBottom: 16,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  word: {
    color: '#f7f8f3',
    fontSize: 24,
    fontWeight: '800',
  },
  normalized: {
    color: '#829087',
    fontSize: 14,
    marginLeft: 8,
  },
  speakButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8, borderRadius: 8, backgroundColor: '#263129' },
  speakButtonText: { color: '#a3e635', fontSize: 13, fontWeight: '700' },
  localInfo: {
    marginBottom: 12,
  },
  phonetic: {
    color: '#a3e635',
    fontSize: 14,
    marginBottom: 4,
  },
  matchedTerm: { color: '#829087', fontSize: 12, marginBottom: 4 },
  onlineLabel: { color: '#829087', fontSize: 11, marginBottom: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { color: '#172009', backgroundColor: '#dff0a8', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
  meaning: {
    color: '#f7f8f3',
    fontSize: 15,
    lineHeight: 22,
  },
  englishMeaning: { color: '#aab5ad', fontSize: 13, lineHeight: 19, marginTop: 8 },
  noEntry: {
    color: '#829087',
    fontSize: 14,
    fontStyle: 'italic',
  },
  sentenceBox: {
    backgroundColor: '#0b100e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1c2420',
  },
  sentenceLabel: {
    color: '#566b17',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sentence: {
    color: '#aab5ad',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1c2420',
  },
  cancelText: {
    color: '#aab5ad',
    fontWeight: '700',
    fontSize: 14,
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#a3e635',
    alignItems: 'center',
  },
  addButtonDisabled: { opacity: 0.5 },
  addButtonPressed: { opacity: 0.8 },
  addButtonText: {
    color: '#0b100e',
    fontWeight: '800',
    fontSize: 14,
  },
  addedBadge: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1c2420',
    alignItems: 'center',
  },
  addedText: {
    color: '#a3e635',
    fontWeight: '700',
    fontSize: 14,
  },
});
