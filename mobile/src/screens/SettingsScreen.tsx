import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Cloud,
  Info,
  Palette,
  Sparkles,
  SunMoon,
  Type,
  Unplug,
} from 'lucide-react-native';
import { SKIN_DEFINITIONS } from '@shared/skins';
import type { SkinId, ThemeMode } from '@shared/types';
import type { AIStatus } from '@shared/types';
import { ScreenBackground } from '../components/ScreenBackground';
import { GlassHeader } from '../components/GlassHeader';
import { GlassSurface } from '../components/GlassSurface';
import { Mascot } from '../components/Mascot';
import { useAppTheme, useThemeController } from '../theme';
import { getCredentials } from '../storage/credentials';
import { unpair } from '../api/syncClient';
import { deleteAIKey, getAIStatus, saveAIKey, testAIKey } from '../api/aiClient';
import { loadFontLicenseText } from '../font';

const AI_CONSENT_VERSION = 3;

const MODE_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

interface Props {
  onBack: () => void;
  onUnpaired: () => void;
  onOpenPairing: () => void;
  paired: boolean;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption,
            fontWeight: '600',
            letterSpacing: 0.4,
          }}
        >
          {title}
        </Text>
      </View>
      {theme.skin === 'glass' ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.xs,
            paddingBottom: theme.spacing.xl,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.borderStrong,
          }}
        >
          {children}
        </View>
      ) : (
        <GlassSurface blur={false} radius={theme.radius.lg} contentStyle={{ padding: theme.spacing.lg }}>
          {children}
        </GlassSurface>
      )}
    </View>
  );
}

export default function SettingsScreen({ onBack, onUnpaired, onOpenPairing, paired }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { preferences, setSkin, setThemeMode, updatePreferences } = useThemeController();
  const [serverUrl, setServerUrl] = useState('');
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [aiStatusError, setAiStatusError] = useState('');
  const deviceSource = preferences.aiSource === 'device';
  const [fontLicenseVisible, setFontLicenseVisible] = useState(false);
  const [fontLicenseText, setFontLicenseText] = useState('');

  useEffect(() => {
    void getAIStatus().then(setAiStatus).catch((error) => {
      setAiStatus({ configured: false, model: '', source: 'none' });
      setAiStatusError(error instanceof Error ? error.message : '无法读取 AI 状态');
    });
  }, []);

  const handleKeyAction = useCallback(async (action: 'save' | 'test' | 'delete') => {
    setKeyBusy(true);
    try {
      if (action === 'save') setAiStatus(await saveAIKey(apiKey));
      if (action === 'delete') setAiStatus(await deleteAIKey());
      if (action === 'test') await testAIKey();
      setAiStatusError('');
      Alert.alert('AI 配置', action === 'test' ? '连接正常' : action === 'save'
        ? deviceSource ? '已安全保存到本机' : '已保存到同步空间'
        : deviceSource ? '已移除本机 Key' : '已移除空间 Key');
    } catch (error) {
      Alert.alert('AI 配置失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setApiKey('');
      setKeyBusy(false);
    }
  }, [apiKey, deviceSource]);

  const changeAiSource = useCallback(async (source: 'device' | 'sync') => {
    if (source === preferences.aiSource) return;
    if (source === 'sync' && !paired) return;
    await updatePreferences({ aiSource: source, aiEnabled: false, aiConsentVersion: 0 });
    setAiStatus(null);
    setAiStatusError('');
    try {
      setAiStatus(await getAIStatus());
    } catch (error) {
      setAiStatusError(error instanceof Error ? error.message : '无法读取 AI 状态');
    }
  }, [paired, preferences.aiSource, updatePreferences]);

  useEffect(() => {
    void getCredentials().then((creds) => setServerUrl(creds.serverUrl || '未配置'));
  }, []);

  const handleToggleAi = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        void updatePreferences({ aiEnabled: false });
        return;
      }
      if (preferences.aiConsentVersion >= AI_CONSENT_VERSION) {
        void updatePreferences({ aiEnabled: true });
        return;
      }
      Alert.alert(
        'AI 整理与隐私',
        deviceSource
          ? '点击「AI 整理」时，当前便签纯文本会从手机直接发送给 DeepSeek；点击「语义查找」时，会发送最近最多 80 条便签各前 300 字。可能产生费用，两项操作都需手动触发，不发送图片。'
          : '点击「AI 整理」时，当前便签纯文本会经同步服务器发送给 DeepSeek；点击「语义查找」时，会发送最近最多 80 条便签各前 300 字。两项操作都需手动触发，不发送图片。整理结果会随便签同步。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '同意并开启',
            onPress: () =>
              void updatePreferences({
                aiEnabled: true,
                aiConsentVersion: AI_CONSENT_VERSION,
              }),
          },
        ]
      );
    },
    [deviceSource, preferences.aiConsentVersion, updatePreferences]
  );

  const handleUnpair = useCallback(() => {
    Alert.alert('解除配对', '解除后将停止与电脑同步，本机便签会保留。', [
      { text: '取消', style: 'cancel' },
      {
        text: '解除配对',
        style: 'destructive',
        onPress: async () => {
          await unpair();
          await updatePreferences({ aiSource: 'device', aiEnabled: false, aiConsentVersion: 0 });
          setAiStatus(await getAIStatus().catch(() => ({ configured: false, model: '', source: 'device' as const })));
          setServerUrl('未配置');
          onUnpaired();
        },
      },
    ]);
  }, [onUnpaired, updatePreferences]);

  const renderSkin = (skin: SkinId) => {
    const definition = SKIN_DEFINITIONS.find((item) => item.id === skin);
    if (!definition) return null;
    const active = preferences.skin === skin;
    const swatches = theme.dark ? definition.swatches.dark : definition.swatches.light;
    return (
      <Pressable
        key={skin}
        onPress={() => void setSkin(skin)}
        style={{
          flexBasis: '47%',
          flexGrow: 0,
          minWidth: 140,
          borderRadius: theme.radius.md,
          borderWidth: theme.skin === 'glass' ? 1 : 2,
          borderColor: active ? theme.colors.accent : theme.colors.border,
          backgroundColor: active ? theme.colors.accentSoft : theme.colors.surface,
          padding: theme.spacing.md,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {skin === 'mote' ? (
            <Mascot size={30} mood="idle" />
          ) : (
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {swatches.slice(1).map((color) => (
                <View
                  key={color}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: color,
                  }}
                />
              ))}
            </View>
          )}
          <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
            {definition.name}
          </Text>
          {active ? (
            <Text style={{ marginLeft: 'auto', color: theme.colors.accent, fontSize: 12 }}>
              ✓
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {swatches.map((color) => (
            <View
              key={color}
              style={{
                flex: 1,
                height: skin === 'glass' ? 18 : 10,
                borderRadius: skin === 'glass' ? theme.radius.sm : 3,
                backgroundColor: color,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.border,
              }}
            />
          ))}
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        <GlassHeader
          title="设置"
          subtitle="外观 · AI · 同步"
          left={
            <Pressable
              onPress={onBack}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={22} color={theme.colors.textMuted} />
            </Pressable>
          }
        />
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.lg,
            paddingBottom: insets.bottom + 40,
            gap: theme.spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Section title="外观" icon={<SunMoon size={14} color={theme.colors.textMuted} />}>
            <View style={{ gap: theme.spacing.lg }}>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: theme.colors.surfaceGlass,
                  borderRadius: theme.radius.pill,
                  padding: 3,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.colors.border,
                }}
              >
                {MODE_OPTIONS.map((option) => {
                  const active = preferences.themeMode === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => void setThemeMode(option.value)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: theme.radius.pill,
                        backgroundColor: active ? theme.colors.accent : 'transparent',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: active ? '600' : '400',
                          color: active ? theme.colors.onAccent : theme.colors.textMuted,
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {SKIN_DEFINITIONS.map((definition) => renderSkin(definition.id))}
              </View>
            </View>
          </Section>

          <Section title="AI 整理" icon={<Sparkles size={14} color={theme.colors.textMuted} />}>
            <View style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => void changeAiSource('device')}
                  style={{ padding: 8, borderRadius: 8, backgroundColor: deviceSource ? theme.colors.accent : theme.colors.surfaceGlass }}>
                  <Text style={{ color: deviceSource ? theme.colors.onAccent : theme.colors.text, fontSize: 12 }}>本机直连</Text>
                </Pressable>
                <Pressable disabled={!paired} onPress={() => void changeAiSource('sync')}
                  style={{ padding: 8, borderRadius: 8, opacity: paired ? 1 : 0.4,
                    backgroundColor: !deviceSource ? theme.colors.accent : theme.colors.surfaceGlass }}>
                  <Text style={{ color: !deviceSource ? theme.colors.onAccent : theme.colors.text, fontSize: 12 }}>同步空间</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                    允许 AI 整理便签
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: 11,
                      lineHeight: 16,
                      marginTop: 2,
                    }}
                  >
                    {deviceSource ? '只在手动点击时调用；Key 安全保存在本机。' : '只在手动点击时调用；Key 保存在同步服务器。'}
                  </Text>
                </View>
                <Switch
                  value={preferences.aiEnabled}
                  onValueChange={handleToggleAi}
                  trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
                  thumbColor={theme.colors.surface}
                />
              </View>
              <View style={styles.divider(theme.colors.border)} />
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                {!deviceSource && !paired ? '请先连接同步服务' : aiStatus === null ? '正在检查 AI 配置…'
                  : deviceSource && aiStatus.configured ? `本机 Key ·••••${aiStatus.keyHint || ''}`
                  : aiStatus.source === 'space' ? `同步空间 Key ·••••${aiStatus.keyHint || ''}`
                  : aiStatus.configured ? '服务器默认 Key' : '尚未配置 AI Key'}
              </Text>
              {!!aiStatusError && <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{aiStatusError}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput value={apiKey} onChangeText={setApiKey} secureTextEntry={!showKey} editable={deviceSource || paired}
                  autoCapitalize="none" autoCorrect={false} placeholder="输入新的 API Key"
                  placeholderTextColor={theme.colors.textSubtle}
                  style={{ flex: 1, borderRadius: theme.radius.md, borderWidth: 1,
                    borderColor: theme.colors.border, color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceGlass, paddingHorizontal: 12, paddingVertical: 9 }} />
                <Pressable onPress={() => setShowKey(!showKey)}><Text style={{ color: theme.colors.accent }}>{showKey ? '隐藏' : '显示'}</Text></Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable disabled={keyBusy || (!deviceSource && !paired) || !apiKey.trim()} onPress={() => void handleKeyAction('save')}>
                  <Text style={{ color: theme.colors.accent, opacity: keyBusy || !apiKey.trim() ? 0.5 : 1 }}>保存</Text>
                </Pressable>
                <Pressable disabled={keyBusy || !aiStatus?.configured} onPress={() => void handleKeyAction('test')}>
                  <Text style={{ color: theme.colors.accent }}>测试连接</Text>
                </Pressable>
                <Pressable disabled={keyBusy || (deviceSource ? !aiStatus?.configured : aiStatus?.source !== 'space')} onPress={() => void handleKeyAction('delete')}>
                  <Text style={{ color: theme.colors.textMuted }}>移除</Text>
                </Pressable>
              </View>
              <View style={styles.divider(theme.colors.border)} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: theme.colors.text, fontSize: 13 }}>
                  在卡片显示一句话摘要
                </Text>
                <Switch
                  value={preferences.showAiSummary}
                  onValueChange={(value) => void updatePreferences({ showAiSummary: value })}
                  trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
                  thumbColor={theme.colors.surface}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: theme.colors.text, fontSize: 13 }}>
                  在卡片显示 AI 标签
                </Text>
                <Switch
                  value={preferences.showAiTags}
                  onValueChange={(value) => void updatePreferences({ showAiTags: value })}
                  trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
                  thumbColor={theme.colors.surface}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: theme.colors.text, fontSize: 13 }}>
                  小墨主题下显示小墨
                </Text>
                <Switch
                  value={preferences.showMascot}
                  onValueChange={(value) => void updatePreferences({ showMascot: value })}
                  trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
                  thumbColor={theme.colors.surface}
                />
              </View>
            </View>
          </Section>

          <Section title="同步" icon={<Cloud size={14} color={theme.colors.textMuted} />}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>服务器</Text>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 13,
                marginTop: 4,
                marginBottom: theme.spacing.md,
              }}
              numberOfLines={1}
            >
              {serverUrl}
            </Text>
            {!paired ? <Pressable onPress={onOpenPairing}
              style={{ paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.md,
                backgroundColor: theme.colors.accent }}>
              <Text style={{ color: theme.colors.onAccent, fontSize: 13 }}>连接同步服务</Text>
            </Pressable> : <Pressable
              onPress={handleUnpair}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
                borderRadius: theme.radius.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.danger,
              }}
            >
              <Unplug size={14} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '600' }}>
                解除配对
              </Text>
            </Pressable>}
          </Section>

          <Section title="关于贴记" icon={<Info size={14} color={theme.colors.textMuted} />}>
            <Text style={{ color: theme.colors.text, fontSize: 13 }}>作者：handsomelittlexing</Text>
          </Section>

          <Section title="字体" icon={<Type size={14} color={theme.colors.textMuted} />}>
            <Text style={{ color: theme.colors.text, fontSize: 13 }}>莲生灵光体 · 作者：莲生</Text>
            <Pressable onPress={() => {
              setFontLicenseVisible(true);
              void loadFontLicenseText().then(setFontLicenseText).catch(() => setFontLicenseText('授权文件读取失败'));
            }}>
              <Text style={{ color: theme.colors.accent, fontSize: 12, marginTop: 6 }}>
                查看完整字体授权
              </Text>
            </Pressable>
            <Pressable onPress={() => void Linking.openURL('https://github.com/kim-wing/liansheng-lingguangti')}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 6 }}>查看字体项目</Text>
            </Pressable>
          </Section>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: 0.75 }}>
            <Palette size={13} color={theme.colors.textSubtle} />
            <Text style={{ color: theme.colors.textSubtle, fontSize: 11 }}>
              皮肤、模式会自动保存，下次打开仍然生效
            </Text>
          </View>
        </ScrollView>
        <Modal visible={fontLicenseVisible} animationType="slide" onRequestClose={() => setFontLicenseVisible(false)}>
          <View style={{ flex: 1, backgroundColor: theme.colors.backgroundStart, padding: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md }}>
              <Text style={{ flex: 1, color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>字体授权</Text>
              <Pressable onPress={() => setFontLicenseVisible(false)}>
                <Text style={{ color: theme.colors.accent, fontSize: 14 }}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView>
              <Text style={{ color: theme.colors.text, fontSize: 12, lineHeight: 20 }}>
                {fontLicenseText || '加载中…'}
              </Text>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </ScreenBackground>
  );
}

const styles = {
  divider: (color: string) => ({
    height: StyleSheet.hairlineWidth,
    backgroundColor: color,
  }),
};
