import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppSettings } from '../appState';
import { AppStateApi } from '../hooks/useAppState';
import { importWordsFromExcelFile, importWordsFromExcelLink } from '../domain/importExcelLink';
import type { AiReadingConfig, LearnerLevel } from '../reading/domain/aiReading';
import {
  DEFAULT_AI_READING_CONFIG,
  loadAiReadingConfig,
  saveAiReadingConfig,
} from '../reading/infrastructure/ai/aiReadingConfig';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, pressedOpacity, radius, spacing } from '../theme';

type RowIcon = keyof typeof Ionicons.glyphMap;

export function SettingsScreen({ app }: { app: AppStateApi }) {
  const [excelLink, setExcelLink] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiReadingConfig>(DEFAULT_AI_READING_CONFIG);
  const [savingAi, setSavingAi] = useState(false);

  useEffect(() => {
    loadAiReadingConfig().then(setAiConfig).catch(() => undefined);
  }, []);

  const saveAiSettings = async () => {
    if (aiConfig.enabled && (!aiConfig.apiUrl.trim() || !aiConfig.apiKey.trim() || !aiConfig.model.trim())) {
      Alert.alert('配置不完整', '启用 AI 阅读教练前，请填写接口地址、API Key 和模型名称。');
      return;
    }
    setSavingAi(true);
    try {
      await saveAiReadingConfig(aiConfig);
      Alert.alert('已保存', aiConfig.enabled ? 'AI 阅读教练已启用。' : 'AI 阅读教练已关闭，阅读时将使用本地降级能力。');
    } catch {
      Alert.alert('保存失败', '无法保存 AI 配置，请稍后重试。');
    } finally {
      setSavingAi(false);
    }
  };

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

  const handleImportExcelFile = async () => {
    setIsImporting(true);
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv',
          'text/tab-separated-values',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const { title, words } = await importWordsFromExcelFile(
        asset.uri,
        asset.name,
        asset.mimeType ?? '',
      );
      const count = app.importWordPack(title, words);
      if (count === 0) {
        Alert.alert('没有导入到词条', '请确认文件包含“单词、释义、例句JSON”等表头。');
        return;
      }
      Alert.alert('导入成功', `已导入并切换到 ${count} 个词条，多义项例句已保留。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法导入所选 Excel 文件。';
      console.warn('Import local Excel failed', error);
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
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>设置</Text>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>学习显示</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <RowIconGlyph name="swap-horizontal-outline" />
              <Text style={styles.rowLabel}>闪卡正面语言</Text>
              <View style={styles.segmented}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => update({ cardFrontLanguage: 'english' })}
                  style={[styles.segmentedItem, app.state.settings.cardFrontLanguage === 'english' && styles.segmentedItemActive]}
                >
                  <Text style={[styles.segmentedText, app.state.settings.cardFrontLanguage === 'english' && styles.segmentedTextActive]}>英文</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => update({ cardFrontLanguage: 'chinese' })}
                  style={[styles.segmentedItem, app.state.settings.cardFrontLanguage === 'chinese' && styles.segmentedItemActive]}
                >
                  <Text style={[styles.segmentedText, app.state.settings.cardFrontLanguage === 'chinese' && styles.segmentedTextActive]}>中文</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.divider} />
            <SwitchRow icon="text-outline" label="显示音标" value={app.state.settings.showPhonetic} onToggle={() => update({ showPhonetic: !app.state.settings.showPhonetic })} />
            <View style={styles.divider} />
            <SwitchRow icon="document-text-outline" label="显示例句" value={app.state.settings.showExample} onToggle={() => update({ showExample: !app.state.settings.showExample })} />
            <View style={styles.divider} />
            <SwitchRow icon="language-outline" label="显示例句翻译" value={app.state.settings.showExampleMeaning} onToggle={() => update({ showExampleMeaning: !app.state.settings.showExampleMeaning })} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>复习参数</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <RowIconGlyph name="layers-outline" />
              <Text style={styles.rowLabel}>单次学习批次</Text>
              <Stepper
                onMinus={() => app.updateStudyPlan({ batchSize: Math.max(5, app.currentPlan.batchSize - 5) })}
                onPlus={() => app.updateStudyPlan({ batchSize: Math.min(30, app.currentPlan.batchSize + 5) })}
                value={app.currentPlan.batchSize}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>每日提醒</Text>
          <View style={styles.group}>
            <SwitchRow icon="notifications-outline" label="开启提醒" value={app.state.settings.reminderEnabled} onToggle={() => app.setReminderEnabled(!app.state.settings.reminderEnabled)} />
            <View style={styles.divider} />
            <View style={styles.row}>
              <RowIconGlyph name="time-outline" />
              <Text style={styles.rowLabel}>提醒时间</Text>
              <View style={styles.timeColumn}>
                <Stepper
                  onMinus={() => app.setReminderTime((app.state.settings.reminderHour + 23) % 24, app.state.settings.reminderMinute)}
                  onPlus={() => app.setReminderTime((app.state.settings.reminderHour + 1) % 24, app.state.settings.reminderMinute)}
                  value={`${String(app.state.settings.reminderHour).padStart(2, '0')}:${String(app.state.settings.reminderMinute).padStart(2, '0')}`}
                />
                <View style={styles.minuteRow}>
                  <Pressable onPress={() => app.setReminderTime(app.state.settings.reminderHour, (app.state.settings.reminderMinute + 50) % 60)} style={({ pressed }) => [styles.minuteButton, pressed && styles.pressed]}>
                    <Text style={styles.minuteButtonText}>-10 分</Text>
                  </Pressable>
                  <Pressable onPress={() => app.setReminderTime(app.state.settings.reminderHour, (app.state.settings.reminderMinute + 10) % 60)} style={({ pressed }) => [styles.minuteButton, pressed && styles.pressed]}>
                    <Text style={styles.minuteButtonText}>+10 分</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>当前词库</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <RowIconGlyph name="library-outline" />
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>{app.activePack?.title ?? '未选择词库'}</Text>
                <Text style={styles.rowFootnote}>
                  当前 {app.deck.length} 条。应用已内置考研词库，也可以继续通过 Excel 导入自己的词库。
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>导入词库</Text>
          <View style={styles.group}>
            <View style={styles.importHelpRow}>
              <Text style={styles.helpText}>
                可直接选择本机 .xlsx、CSV、TSV 文件；支持“例句JSON”多义项结构，也兼容旧版例句列。
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.importButtonRow}>
              <PrimaryButton
                label={isImporting ? '正在导入...' : '选择本地 Excel 文件'}
                onPress={handleImportExcelFile}
                disabled={isImporting}
                variant="soft"
                style={styles.importButton}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.importLinkRow}>
              <TextInput
                value={excelLink}
                onChangeText={setExcelLink}
                placeholder="或通过公开链接导入：https://..."
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />
              <PrimaryButton label="导入并切换" onPress={handleImportExcelLink} disabled={isImporting} style={styles.importButton} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>词库切换</Text>
          <View style={styles.group}>
            {app.availablePacks.length === 0 ? (
              <View style={styles.row}><Text style={styles.helpText}>暂无词库。请粘贴 Excel 链接导入。</Text></View>
            ) : null}
            {app.availablePacks.map((pack, index) => (
              <View key={pack.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.row}>
                  <RowIconGlyph name="albums-outline" />
                  <View style={styles.rowTextCol}>
                    <Text style={styles.rowLabel}>{pack.title}</Text>
                    <Text style={styles.rowFootnote}>
                      {pack.description} {pack.words.length > 0 ? `共 ${pack.words.length} 条` : '等待词库生成'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      app.switchPack(pack.id);
                      Alert.alert('已切换', `当前词库：${pack.title}`);
                    }}
                    disabled={pack.id === app.state.activePackId}
                    style={[styles.packButton, pack.id === app.state.activePackId && styles.packButtonActive]}
                  >
                    <Text style={[styles.packButtonText, pack.id === app.state.activePackId && styles.packButtonTextActive]}>
                      {pack.id === app.state.activePackId ? '使用中' : '切换'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>AI 阅读教练</Text>
          <View style={styles.group}>
            <View style={styles.importHelpRow}>
              <Text style={styles.helpText}>
                用于语境词义、长句拆解、段落回忆和复述评价。支持 OpenAI 兼容接口；密钥只保存在本机应用数据中。
              </Text>
            </View>
            <View style={styles.divider} />
            <SwitchRow icon="sparkles-outline" label="启用 AI 阅读增强" value={aiConfig.enabled} onToggle={() => setAiConfig((current) => ({ ...current, enabled: !current.enabled }))} />
            <View style={styles.divider} />
            <View style={styles.aiForm}>
              <TextInput
                value={aiConfig.apiUrl}
                onChangeText={(apiUrl) => setAiConfig((current) => ({ ...current, apiUrl }))}
                placeholder="接口地址，例如 https://api.openai.com/v1/chat/completions"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />
              <TextInput
                value={aiConfig.apiKey}
                onChangeText={(apiKey) => setAiConfig((current) => ({ ...current, apiKey }))}
                placeholder="API Key"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={styles.input}
              />
              <TextInput
                value={aiConfig.model}
                onChangeText={(model) => setAiConfig((current) => ({ ...current, model }))}
                placeholder="模型名称，例如 gpt-4.1-mini"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <View style={styles.levelRow}>
                {([
                  ['beginner', '初级'],
                  ['intermediate', '中级'],
                  ['advanced', '高级'],
                ] as Array<[LearnerLevel, string]>).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => setAiConfig((current) => ({ ...current, learnerLevel: value }))}
                    style={[styles.levelButton, aiConfig.learnerLevel === value && styles.levelButtonActive]}
                  >
                    <Text style={[styles.levelText, aiConfig.learnerLevel === value && styles.levelTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <PrimaryButton label={savingAi ? '保存中…' : '保存 AI 配置'} onPress={saveAiSettings} disabled={savingAi} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>危险操作</Text>
          <View style={[styles.group, styles.dangerGroup]}>
            <Pressable onPress={confirmResetAll} style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.dangerLabel}>清空所有学习数据</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowIconGlyph({ name }: { name: RowIcon }) {
  return (
    <View style={styles.rowIcon}>
      <Ionicons name={name} size={17} color={colors.accent} />
    </View>
  );
}

function SwitchRow({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: RowIcon;
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <RowIconGlyph name={icon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.accent }}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: number | string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel="减少" onPress={onMinus} style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
        <Ionicons name="remove" size={16} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="增加" onPress={onPlus} style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
        <Ionicons name="add" size={16} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: 48, gap: spacing.xxl - 2 },
  pageTitle: { color: colors.textPrimary, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: spacing.sm, marginBottom: spacing.xs },

  section: { gap: spacing.sm },
  sectionHeader: { color: colors.textTertiary, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: spacing.xs + 2 },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md - 1, minHeight: 46 },
  rowIcon: { width: 28, height: 28, borderRadius: radius.sm - 2, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '400' },
  rowTextCol: { flex: 1, gap: 3 },
  rowFootnote: { color: colors.textTertiary, fontSize: 12, lineHeight: 17 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 40 },

  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 2, gap: 2 },
  segmentedItem: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: radius.sm, minWidth: 52, alignItems: 'center' },
  segmentedItemActive: { backgroundColor: colors.accentMuted },
  segmentedText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  segmentedTextActive: { color: colors.accent, fontWeight: '600' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepperButton: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { color: colors.textPrimary, minWidth: 40, textAlign: 'center', fontSize: 15, fontWeight: '600' },

  timeColumn: { alignItems: 'flex-end', gap: spacing.sm },
  minuteRow: { flexDirection: 'row', gap: spacing.sm },
  minuteButton: { borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 11, paddingVertical: 6 },
  minuteButtonText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },

  importHelpRow: { paddingVertical: spacing.md - 1 },
  importButtonRow: { paddingVertical: spacing.md - 1 },
  importLinkRow: { paddingVertical: spacing.md - 1, gap: spacing.md },
  importButton: { alignSelf: 'flex-start' },
  helpText: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },

  aiForm: { paddingVertical: spacing.md - 1, gap: spacing.md },

  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: colors.textPrimary,
    fontSize: 14,
  },

  levelRow: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 2, gap: 2 },
  levelButton: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  levelButtonActive: { backgroundColor: colors.accentMuted },
  levelText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  levelTextActive: { color: colors.accent, fontWeight: '600' },

  packButton: { borderRadius: radius.full, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 7 },
  packButtonActive: { backgroundColor: colors.accentMuted },
  packButtonText: { color: colors.accentInk, fontSize: 13, fontWeight: '600' },
  packButtonTextActive: { color: colors.accent },

  dangerGroup: { backgroundColor: colors.dangerMuted, borderColor: '#5A2626' },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  dangerLabel: { flex: 1, color: colors.dangerSoft, fontSize: 15, fontWeight: '500' },

  pressed: { opacity: pressedOpacity },
});
