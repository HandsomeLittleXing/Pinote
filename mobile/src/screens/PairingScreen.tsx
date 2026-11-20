import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, QrCode, Smartphone, X } from 'lucide-react-native';
import { redeemPairingCode } from '../api/syncClient';
import { ScreenBackground } from '../components/ScreenBackground';
import { GlassSurface } from '../components/GlassSurface';
import { useToast } from '../components/GlassToast';
import { useAppTheme } from '../theme';

// 默认留空，由用户在配对页填写或扫码带入；
// 本地/USB 调试可在 mobile/.env 里设置 EXPO_PUBLIC_SERVER_URL
const DEFAULT_SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? '';

interface Props {
  onPaired: () => void;
  onBack: () => void;
}

export default function PairingScreen({ onPaired, onBack }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleRedeem = useCallback(
    async (pairingCode: string, serverOverride?: string) => {
      const targetServer = (serverOverride ?? serverUrl).trim();
      if (!targetServer || !pairingCode.trim()) {
        setError('请填写服务器地址和配对码');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await redeemPairingCode(targetServer, pairingCode.trim());
        onPaired();
      } catch (err) {
        const message = err instanceof Error ? err.message : '配对失败';
        setError(message);
        showToast({ message, variant: 'error' });
      } finally {
        setLoading(false);
        setScanning(false);
      }
    },
    [serverUrl, onPaired, showToast]
  );

  const handleScanPress = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('需要相机权限', '请在系统设置中允许访问相机以扫码配对');
        return;
      }
    }
    setScanning(true);
  }, [permission, requestPermission]);

  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (!data) return;
            try {
              const parsed = JSON.parse(data) as { serverUrl?: string; code?: string };
              if (parsed.code) {
                if (parsed.serverUrl) setServerUrl(parsed.serverUrl);
                setCode(parsed.code);
                void handleRedeem(parsed.code, parsed.serverUrl);
                return;
              }
            } catch {
              // 非 JSON，按纯配对码处理
            }
            setCode(data);
            void handleRedeem(data);
          }}
        />

        <View
          pointerEvents="none"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{
              width: 240,
              height: 240,
              borderRadius: 24,
              borderWidth: 2,
              borderColor: theme.colors.accent,
            }}
          />
        </View>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 16,
            left: 16,
            right: 16,
            alignItems: 'center',
          }}
        >
          <GlassSurface
            blur={false}
            radius={999}
            contentStyle={{ paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 13 }}>
              将二维码放入框内
            </Text>
          </GlassSurface>
        </View>

        <Pressable
          onPress={() => setScanning(false)}
          style={{
            position: 'absolute',
            bottom: insets.bottom + 24,
            alignSelf: 'center',
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }

  const fieldStyle = {
    backgroundColor: theme.colors.inputBackground,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  } as const;

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={onBack} style={{ alignSelf: 'flex-start', marginBottom: 18, paddingVertical: 6 }}>
            <Text style={{ color: theme.colors.accent, fontSize: 13 }}>返回设置</Text>
          </Pressable>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <GlassSurface
              radius={999}
              style={{ width: 76, height: 76 }}
              contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Smartphone size={32} color={theme.colors.accent} />
            </GlassSurface>
            <Text
              style={{
                marginTop: 18,
                fontSize: 24,
                fontWeight: '700',
                color: theme.colors.text,
              }}
            >
              连接贴记桌面端
            </Text>
            <Text
              style={{
                marginTop: 8,
                maxWidth: 300,
                textAlign: 'center',
                fontSize: 13,
                lineHeight: 20,
                color: theme.colors.textMuted,
              }}
            >
              在电脑端「设置 → 手机同步」生成配对码，然后在此输入或扫码
            </Text>
          </View>

          <GlassSurface
            radius={theme.radius.xl}
            contentStyle={{ padding: 18, gap: 14 }}
          >
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>
                同步服务器地址
              </Text>
              <TextInput
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://192.168.1.5:4000"
                placeholderTextColor={theme.colors.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={theme.colors.accent}
                style={fieldStyle}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>
                配对码
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="6 位数字"
                placeholderTextColor={theme.colors.textSubtle}
                keyboardType="number-pad"
                maxLength={6}
                selectionColor={theme.colors.accent}
                style={[
                  fieldStyle,
                  {
                    fontSize: 24,
                    letterSpacing: 6,
                    textAlign: 'center',
                    fontWeight: '600',
                  },
                ]}
              />
            </View>

            {error ? (
              <Text style={{ fontSize: 12, color: theme.colors.danger }}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void handleRedeem(code)}
              disabled={loading}
              style={({ pressed }) => [
                {
                  height: 48,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.accent,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: loading ? 0.6 : pressed ? 0.9 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.onAccent} />
              ) : (
                <>
                  <Text style={{ color: theme.colors.onAccent, fontSize: 15, fontWeight: '600' }}>
                    确认配对
                  </Text>
                  <ArrowRight size={16} color={theme.colors.onAccent} />
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => void handleScanPress()}
              style={{
                height: 46,
                borderRadius: theme.radius.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceGlass,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <QrCode size={16} color={theme.colors.textMuted} />
              <Text style={{ fontSize: 14, color: theme.colors.textMuted }}>
                扫描二维码
              </Text>
            </Pressable>
          </GlassSurface>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
