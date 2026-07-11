import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSettings } from '../appState';
import { AppStateApi } from '../hooks/useAppState';
import { importWordsFromExcelLink } from '../domain/importExcelLink';

export function SettingsScreen({ app }: { app: AppStateApi }) {
  const [excelLink, setExcelLink] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImportExcelLink = async () => {
    const link = excelLink.trim();
    if (!link) {
      Alert.alert('请输入链接', '请粘贴可访问的 Excel 或在线表格链接。');
      return;
    }

    setIsImporting(true);
    try {
      const { title, words } = await importWordsFromExcelLink(link);
      const count = app.importWordPack(title, words);
      if (count === 0) {
        Alert.alert('没有导入到词条', '请确认链接可访问，并且表格包含“单词 / 英音 / 美音 / 释义”等列。');
        return;
      }
      Alert.alert('导入成功', `已导入并切换到 ${count} 个词条。`);
      setExcelLink('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '请确认链接可以直接访问 .xlsx、CSV、TSV 或公开的 Google Sheets。';
      console.warn('Import Excel link failed', error);
      Alert.alert('导入失败', message);
    } finally {
      setIsImporting(false);
    }
  };

  const update = (patch: Partial<AppSettings>) => {
    app.updateSettings(patch);
  };

  const confirmResetAll = () => {
    Alert.alert('确认清空所有学习数据？', '这会删除本地学习进度、收藏、复习记录和导入词库。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: () => {
          app.resetAll().catch(() => {
            Alert.alert('清空失败', '请稍后再试。');
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>学习显示</Text>
          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>闪卡正面语言</Text>
            <View style={styles.languageRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => update({ cardFrontLanguage: 'english' })}
                style={[styles.languageButton, app.state.settings.cardFrontLanguage === 'english' && styles.languageButtonActive]}
              >
                <Text style={[styles.languageText, app.state.settings.cardFrontLanguage === 'english' && styles.languageTextActive]}>英文</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => update({ cardFrontLanguage: 'chinese' })}
                style={[styles.languageButton, app.state.settings.cardFrontLanguage === 'chinese' && styles.languageButtonActive]}
              >
                <Text style={[styles.languageText, app.state.settings.cardFrontLanguage === 'chinese' && styles.languageTextActive]}>中文</Text>
              </Pressable>
            </View>
          </View>
          <SwitchRow
            label="显示音标"
            value={app.state.settings.showPhonetic}
            onToggle={() => update({ showPhonetic: !app.state.settings.showPhonetic })}
          />
          <SwitchRow
            label="显示例句"
            value={app.state.settings.showExample}
            onToggle={() => update({ showExample: !app.state.settings.showExample })}
          />
          <SwitchRow
            label="显示例句翻译"
            value={app.state.settings.showExampleMeaning}
            onToggle={() => update({ showExampleMeaning: !app.state.settings.showExampleMeaning })}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>复习参数</Text>
          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>单次学习批次</Text>
            <View style={styles.counterRow}>
              <Pressable
                onPress={() =>
                  app.updateStudyPlan({ batchSize: Math.max(5, app.currentPlan.batchSize - 5) })
                }
                style={styles.counterButton}
              >
                <Text style={styles.counterButtonText}>-</Text>
              </Pressable>
              <Text style={styles.counterValue}>{app.currentPlan.batchSize}</Text>
              <Pressable
                onPress={() =>
                  app.updateStudyPlan({ batchSize: Math.min(30, app.currentPlan.batchSize + 5) })
                }
                style={styles.counterButton}
              >
                <Text style={styles.counterButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>每日提醒</Text>
          <SwitchRow
            label="开启提醒"
            value={app.state.settings.reminderEnabled}
            onToggle={() => app.setReminderEnabled(!app.state.settings.reminderEnabled)}
          />
          <View style={styles.counterCard}>
            <Text style={styles.counterLabel}>提醒时间</Text>
            <View style={styles.counterRow}>
              <Pressable
                onPress={() =>
                  app.setReminderTime(
                    (app.state.settings.reminderHour + 23) % 24,
                    app.state.settings.reminderMinute,
                  )
                }
                style={styles.counterButton}
              >
                <Text style={styles.counterButtonText}>-</Text>
              </Pressable>
              <Text style={styles.counterValue}>
                {String(app.state.settings.reminderHour).padStart(2, '0')}:
                {String(app.state.settings.reminderMinute).padStart(2, '0')}
              </Text>
              <Pressable
                onPress={() =>
                  app.setReminderTime(
                    (app.state.settings.reminderHour + 1) % 24,
                    app.state.settings.reminderMinute,
                  )
                }
                style={styles.counterButton}
              >
                <Text style={styles.counterButtonText}>+</Text>
              </Pressable>
            </View>
            <View style={styles.minuteRow}>
              <Pressable
                onPress={() =>
                  app.setReminderTime(
                    app.state.settings.reminderHour,
                    (app.state.settings.reminderMinute + 50) % 60,
                  )
                }
                style={styles.minuteButton}
              >
                <Text style={styles.minuteButtonText}>-10 分</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  app.setReminderTime(
                    app.state.settings.reminderHour,
                    (app.state.settings.reminderMinute + 10) % 60,
                  )
                }
                style={styles.minuteButton}
              >
                <Text style={styles.minuteButtonText}>+10 分</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>当前词库</Text>
          <View style={styles.packCard}>
            <View style={styles.packInfo}>
              <Text style={styles.packTitle}>{app.activePack?.title ?? '未选择词库'}</Text>
              <Text style={styles.packDesc}>
                当前 {app.deck.length} 条。应用已内置考研词库，也可以继续通过 Excel 链接导入自己的词库。
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>导入 Excel 数据</Text>
          <Text style={styles.helpText}>
            只粘贴 Excel 链接。支持可直接下载的 .xlsx、CSV/TSV 链接，以及公开的 Google Sheets 链接。
          </Text>
          <TextInput
            value={excelLink}
            onChangeText={setExcelLink}
            placeholder="https://..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <Pressable
            onPress={handleImportExcelLink}
            disabled={isImporting}
            style={[styles.primaryButton, isImporting ? styles.disabledButton : null]}
          >
            <Text style={styles.primaryButtonText}>{isImporting ? '正在导入...' : '导入并切换词库'}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>词库切换</Text>
          {app.availablePacks.length === 0 ? (
            <Text style={styles.helpText}>暂无词库。请粘贴 Excel 链接导入。</Text>
          ) : null}
          {app.availablePacks.map((pack) => (
            <View key={pack.id} style={styles.packCard}>
              <View style={styles.packInfo}>
                <Text style={styles.packTitle}>{pack.title}</Text>
                <Text style={styles.packDesc}>
                  {pack.description} {pack.words.length > 0 ? `共 ${pack.words.length} 条` : '等待词库生成'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  app.switchPack(pack.id);
                  Alert.alert('已切换', `当前词库：${pack.title}`);
                }}
                style={[styles.packButton, pack.id === app.state.activePackId ? styles.packButtonActive : null]}
              >
                <Text style={styles.packButtonText}>
                  {pack.id === app.state.activePackId ? '使用中' : '切换'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>危险操作</Text>
          <Pressable onPress={confirmResetAll} style={styles.dangerButton}>
            <Text style={styles.dangerButtonText}>清空所有学习数据</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SwitchRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Text style={[styles.switchValue, value ? styles.switchOn : styles.switchOff]}>
        {value ? '开启' : '关闭'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b100e',
  },
  container: {
    padding: 20,
    paddingTop: 8,
    gap: 18,
  },
  hero: {
    paddingTop: 18,
    paddingBottom: 8,
    gap: 8,
  },
  kicker: {
    color: '#86efac',
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  helpText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
  },
  switchRow: {
    backgroundColor: '#18212b',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  switchValue: {
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  switchOn: {
    color: '#dcfce7',
    backgroundColor: '#14532d',
  },
  switchOff: {
    color: '#cbd5e1',
    backgroundColor: '#334155',
  },
  counterCard: {
    backgroundColor: '#18212b',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  counterLabel: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonText: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  counterValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  minuteRow: {
    flexDirection: 'row',
    gap: 10,
  },
  languageRow: { flexDirection: 'row', gap: 10 },
  languageButton: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  languageButtonActive: { backgroundColor: '#bbf7d0' },
  languageText: { color: '#cbd5e1', fontWeight: '800' },
  languageTextActive: { color: '#052e16' },
  minuteButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  minuteButtonText: {
    color: '#e2e8f0',
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#243241',
  },
  primaryButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  dangerButton: {
    backgroundColor: '#7f1d1d',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#fecaca',
    fontSize: 16,
    fontWeight: '800',
  },
  packCard: {
    backgroundColor: '#18212b',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  packInfo: {
    gap: 4,
  },
  packTitle: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 15,
  },
  packDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  packButton: {
    backgroundColor: '#86efac',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  packButtonActive: {
    backgroundColor: '#bbf7d0',
  },
  packButtonText: {
    color: '#052e16',
    fontWeight: '900',
  },
});
