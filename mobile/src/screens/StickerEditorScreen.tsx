import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, RefreshCw, Trash2 } from 'lucide-react-native';
import { STICKER_PALETTE, resolveStickerColor } from '@shared/palette';
import type { Sticker } from '@shared/types';
import { getStickerById, softDeleteSticker, upsertSticker } from '../storage/db';
import { syncNow } from '../api/syncClient';
import { ScreenBackground } from '../components/ScreenBackground';
import { GlassHeader } from '../components/GlassHeader';
import { useToast } from '../components/GlassToast';
import { getStickerSurface, useAppTheme } from '../theme';

interface Props {
  stickerId: string;
  onBack: () => void;
}

export default function StickerEditorScreen({ stickerId, onBack }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const editorRef = useRef<RichEditor>(null);
  const stickerRef = useRef<Sticker | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const loaded = await getStickerById(stickerId);
    stickerRef.current = loaded;
    setSticker(loaded);
  }, [stickerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistNow = useCallback(async (partial: Partial<Sticker>) => {
    const current = stickerRef.current;
    if (!current) return;
    const updated: Sticker = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    stickerRef.current = updated;
    setSticker(updated);
    await upsertSticker(updated);
  }, []);

  const handleContentChange = useCallback(
    (html: string) => {
      setSaveStatus('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await persistNow({ content: html });
          setSaveStatus('saved');
        } catch (error) {
          console.error('保存便签失败:', error);
          setSaveStatus('saved');
          showToast({ message: '保存失败', variant: 'error' });
        }
      }, 400);
    },
    [persistNow, showToast]
  );

  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      const html = await editorRef.current?.getContentHtml();
      if (typeof html === 'string') {
        await persistNow({ content: html });
      }
      setSaveStatus('saved');
    } catch (error) {
      console.error('保存便签失败:', error);
    }
  }, [persistNow]);

  const handleBack = useCallback(async () => {
    await flushSave();
    onBack();
  }, [flushSave, onBack]);

  const handleBlur = useCallback(() => {
    void flushSave();
  }, [flushSave]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const surface = sticker ? getStickerSurface(sticker.color, theme.dark) : null;
  const noteBg = surface?.background ?? theme.colors.backgroundStart;
  const noteText = surface?.text ?? theme.colors.text;

  // 颜色切换后同步 WebView 的背景/文字色（editorStyle 只在初始化时生效）
  useEffect(() => {
    if (!sticker) return;
    try {
      editorRef.current?.commandDOM(
        `document.body.style.background='${noteBg}';document.body.style.color='${noteText}';`
      );
    } catch {
      // 编辑器还未 ready 时忽略
    }
  }, [noteBg, noteText, sticker?.id]);

  const handleColor = useCallback(
    async (color: Sticker['color']) => {
      await persistNow({ color });
      setSaveStatus('saved');
    },
    [persistNow]
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await flushSave();
      await syncNow();
      showToast({ message: '同步完成', variant: 'success' });
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : '同步失败',
        variant: 'error',
      });
    } finally {
      setSyncing(false);
    }
  }, [flushSave, showToast]);

  const handleDelete = useCallback(() => {
    Alert.alert('删除便签', '确定要删除这张便签吗？其他设备同步后也会删除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await softDeleteSticker(stickerId);
          await syncNow().catch(() => {});
          onBack();
        },
      },
    ]);
  }, [stickerId, onBack]);

  if (!sticker) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        <GlassHeader
          title="便签"
          subtitle={saveStatus === 'saving' ? '保存中…' : '已保存'}
          left={
            <Pressable
              onPress={() => void handleBack()}
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
          right={
            <>
              <Pressable
                onPress={() => void handleSync()}
                disabled={syncing}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <RefreshCw size={18} color={theme.colors.textMuted} />
                )}
              </Pressable>
              <Pressable
                onPress={handleDelete}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={18} color={theme.colors.textMuted} />
              </Pressable>
            </>
          }
        />

        <View
          style={{
            flex: 1,
            marginHorizontal: theme.spacing.md,
            marginTop: theme.spacing.sm + 2,
            marginBottom: insets.bottom + theme.spacing.sm,
            borderRadius: theme.radius.xl,
            overflow: 'hidden',
            backgroundColor: noteBg,
            shadowColor: theme.dark ? '#000000' : '#0F172A',
            shadowOpacity: 0.12,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 5,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: theme.spacing.md,
              paddingTop: theme.spacing.sm + 2,
              paddingBottom: theme.spacing.xs,
            }}
          >
            {STICKER_PALETTE.map((item) => {
              const active =
                resolveStickerColor(sticker.color).color === item.color;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => void handleColor(item.color)}
                  hitSlop={4}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    borderWidth: 2,
                    borderColor: active ? theme.colors.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: theme.dark ? item.darkColor : item.color,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: theme.colors.borderStrong,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>

          <RichToolbar
            editor={editorRef}
            actions={[
              actions.setBold,
              actions.setItalic,
              actions.insertBulletsList,
              actions.insertOrderedList,
              actions.undo,
              actions.redo,
            ]}
            iconTint={theme.colors.textMuted}
            selectedIconTint={theme.colors.accent}
            disabledIconTint={theme.colors.textSubtle}
            style={{
              backgroundColor: 'transparent',
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.colors.border,
            }}
            iconMap={{
              [actions.setBold]: ({ tintColor }: { tintColor: string }) => (
                <Text style={{ color: tintColor, fontSize: 15, fontWeight: '700' }}>B</Text>
              ),
              [actions.setItalic]: ({ tintColor }: { tintColor: string }) => (
                <Text style={{ color: tintColor, fontSize: 15, fontStyle: 'italic' }}>I</Text>
              ),
            }}
          />

          {/*
            不要把 RichEditor 放进 ScrollView。WebView 会自己滚动，
            外层 ScrollView 会拦截触摸，导致点击编辑区无法拉起输入法键盘。
          */}
          <RichEditor
            ref={editorRef}
            initialContentHTML={sticker.content}
            onChange={handleContentChange}
            onBlur={handleBlur}
            initialFocus={false}
            style={{ flex: 1, backgroundColor: noteBg }}
            editorStyle={{
              backgroundColor: noteBg,
              color: noteText,
              caretColor: theme.colors.accent,
              placeholderColor: theme.colors.textSubtle,
              contentCSSText: `font-size: 15px; line-height: 1.7; color: ${noteText};`,
            }}
            placeholder="开始输入..."
          />
        </View>
      </View>
    </ScreenBackground>
  );
}
