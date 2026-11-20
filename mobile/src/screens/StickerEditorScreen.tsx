import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/AppText';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Ellipsis, Sparkles, X } from 'lucide-react-native';
import { STICKER_PALETTE, resolveGlassCardColor, resolveStickerColor } from '@shared/palette';
import { getStickerDoodleDataUri, getStickerDoodleForId } from '@shared/stickerDoodles';
import { adoptAiTags, computeContentHash, isAIUsable, noteToPlainText } from '@shared/ai';
import { renderRewriteHtml } from '@shared/aiRewrite';
import type { AIRewriteResponse, Sticker } from '@shared/types';
import { getStickerById, softDeleteSticker, upsertSticker } from '../storage/db';
import { annotateNote, rewriteNote } from '../api/aiClient';
import { syncNow } from '../api/syncClient';
import { ScreenBackground } from '../components/ScreenBackground';
import { GlassHeader } from '../components/GlassHeader';
import { GrainOverlay } from '../components/GrainOverlay';
import { AiResultSheet } from '../components/AiResultSheet';
import { AiRewriteSheet } from '../components/AiRewriteSheet';
import { AnnotationPreview } from '../components/AnnotationPreview';
import { useToast } from '../components/GlassToast';
import { StickerManageSheet } from '../components/StickerManageSheet';
import { reconcileReminders, requestReminderPermission } from '../notifications/reminders';
import { getStickerSurface, useAppTheme, useThemeController } from '../theme';
import { APP_FONT_FAMILY, loadEditorFontCss } from '../font';

interface Props {
  stickerId: string;
  onBack: () => void;
  onOpenSettings: () => void;
  paired: boolean;
}

export default function StickerEditorScreen({ stickerId, onBack, onOpenSettings, paired }: Props) {
  const theme = useAppTheme();
  const { preferences } = useThemeController();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const editorRef = useRef<RichEditor>(null);
  const stickerRef = useRef<Sticker | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [syncing, setSyncing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [rewrite, setRewrite] = useState<{ sourceText: string; result: AIRewriteResponse } | null>(null);
  const [rewriteUndo, setRewriteUndo] = useState<{ before: string; afterHash: string; ai: Sticker['ai'] } | null>(null);
  const [manageVisible, setManageVisible] = useState(false);
  const [editorFontCss, setEditorFontCss] = useState<string | null>(null);

  const load = useCallback(async () => {
    const loaded = await getStickerById(stickerId);
    stickerRef.current = loaded;
    setSticker(loaded);
  }, [stickerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    void loadEditorFontCss().then((css) => {
      if (mounted) setEditorFontCss(css);
    }).catch((error) => {
      console.error('加载编辑器字体失败:', error);
      if (mounted) setEditorFontCss('');
    });
    return () => { mounted = false; };
  }, []);

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
          if (html !== stickerRef.current?.content) await persistNow({ content: html });
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
      if (typeof html === 'string' && html !== stickerRef.current?.content) {
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
  const glass = sticker && theme.skin === 'glass'
    ? resolveGlassCardColor(sticker.color, theme.dark)
    : null;
  const noteBg = glass?.surface ?? surface?.background ?? theme.colors.backgroundStart;
  const noteText = glass?.ink ?? surface?.text ?? theme.colors.text;
  const doodleUri = glass && sticker
    ? getStickerDoodleDataUri(getStickerDoodleForId(sticker.id), noteText, theme.dark ? 0.18 : 0.15)
    : null;
  const hasFreshAI = sticker
    ? isAIUsable(sticker.ai, noteToPlainText(sticker.content))
    : false;
  const previewFresh = isAIUsable(sticker?.ai ?? null, previewText);

  // editorStyle 的初始 CSS 不会覆盖已打开的 WebView，换色时同步装饰层。
  useEffect(() => {
    if (!sticker) return;
    try {
      editorRef.current?.commandDOM(
        `document.body.style.backgroundColor=${JSON.stringify(noteBg)};` +
        `document.body.style.color=${JSON.stringify(noteText)};` +
        `var content=$('.pell-content');if(content){` +
        `content.style.color=${JSON.stringify(noteText)};` +
        `content.style.backgroundImage=${JSON.stringify(doodleUri ? `url("${doodleUri}")` : 'none')};` +
        `content.style.backgroundRepeat='no-repeat';` +
        `content.style.backgroundPosition='right 8px bottom 12px';` +
        `content.style.backgroundSize='210px auto';}`
      );
    } catch {
      // 编辑器还未 ready 时忽略
    }
  }, [doodleUri, noteBg, noteText, sticker?.id]);

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
          await reconcileReminders();
          setManageVisible(false);
          if (paired) await syncNow().catch(() => {});
          onBack();
        },
      },
    ]);
  }, [stickerId, onBack]);

  const runAI = useCallback(
    async (force = false) => {
      if (!preferences.aiEnabled) {
        Alert.alert(
          'AI 整理未开启',
          preferences.aiSource === 'device'
            ? '需要先在设置中开启 AI 整理，并同意将便签文本从本机直接发送给 DeepSeek。'
            : '需要先在设置中开启 AI 整理，并同意将便签文本发送给服务器配置的模型。',
          [
            { text: '取消', style: 'cancel' },
            { text: '去设置', onPress: onOpenSettings },
          ]
        );
        return;
      }
      if (aiBusy) return;
      setAiBusy(true);
      try {
        await flushSave();
        const html = await editorRef.current?.getContentHtml();
        const currentHtml =
          typeof html === 'string' ? html : stickerRef.current?.content ?? '';
        const plainText = noteToPlainText(currentHtml);
        if (!plainText) {
          showToast({ message: '便签还是空的', variant: 'info' });
          return;
        }

        const contentHash = computeContentHash(plainText);
        const result = await annotateNote(plainText, contentHash, force);

        // 网络期间可能又改了正文：确认结果仍对应当前内容
        const latestHtml = await editorRef.current?.getContentHtml();
        const latestPlain = noteToPlainText(
          typeof latestHtml === 'string' ? latestHtml : currentHtml
        );
        if (computeContentHash(latestPlain) !== result.annotation.contentHash) {
          showToast({ message: '内容已变化，请重新整理', variant: 'error' });
          return;
        }

        await persistNow({ ai: result.annotation });
        Keyboard.dismiss();
        setSheetVisible(true);
        if (paired) void syncNow().catch(() => {});
      } catch (error) {
        showToast({
          message: error instanceof Error ? error.message : 'AI 整理失败',
          variant: 'error',
        });
      } finally {
        setAiBusy(false);
      }
    },
    [aiBusy, flushSave, onOpenSettings, paired, persistNow, preferences.aiEnabled, preferences.aiSource, showToast]
  );

  const openPreview = useCallback(async () => {
    const html = await editorRef.current?.getContentHtml();
    const text = noteToPlainText(
      typeof html === 'string' ? html : stickerRef.current?.content ?? ''
    );
    Keyboard.dismiss();
    setPreviewText(text);
    setPreviewVisible(true);
  }, []);

  const handleAdoptTag = useCallback(
    async (tag: string) => {
      const current = stickerRef.current;
      if (!current) return;
      const tags = adoptAiTags(current.tags, [tag]);
      if (tags.length !== current.tags.length) await persistNow({ tags });
    },
    [persistNow]
  );

  const handleAdoptAllTags = useCallback(async () => {
    const current = stickerRef.current;
    if (!current?.ai) return;
    const merged = adoptAiTags(current.tags, current.ai.tags);
    if (merged.length === current.tags.length) return;
    await persistNow({ tags: merged });
  }, [persistNow]);

  const handleAdoptTodo = useCallback(async (text: string) => {
    const current = stickerRef.current;
    if (!current || (current.tasks ?? []).some((task) => task.text === text)) return;
    await persistNow({ tasks: [...(current.tasks ?? []), { id: Crypto.randomUUID(), text, done: false }] });
    showToast({ message: '已加入待办', variant: 'success' });
  }, [persistNow, showToast]);

  const toggleTask = useCallback(async (id: string) => {
    const current = stickerRef.current;
    if (!current) return;
    await persistNow({ tasks: (current.tasks ?? []).map((task) =>
      task.id === id ? { ...task, done: !task.done } : task) });
  }, [persistNow]);

  const removeTask = useCallback(async (id: string) => {
    const current = stickerRef.current;
    if (!current) return;
    await persistNow({ tasks: (current.tasks ?? []).filter((task) => task.id !== id) });
  }, [persistNow]);

  const runRewrite = useCallback(async () => {
    if (!preferences.aiEnabled) { Alert.alert('AI 整理未开启', '请先在设置中开启 AI 整理。'); return; }
    if (aiBusy) return;
    const html = await editorRef.current?.getContentHtml();
    const currentHtml = typeof html === 'string' ? html : stickerRef.current?.content || '';
    if (/<(?:img|iframe|video|audio|object|embed)\b/i.test(currentHtml)) {
      Alert.alert('暂不支持', '含图片或嵌入内容的便签不能一键替换。'); return;
    }
    const plainText = noteToPlainText(currentHtml);
    if (!plainText) { showToast({ message: '便签还是空的', variant: 'info' }); return; }
    setAiBusy(true);
    try {
      await flushSave();
      const result = await rewriteNote({ plainText, contentHash: computeContentHash(plainText) });
      const latestHtml = await editorRef.current?.getContentHtml();
      if (computeContentHash(noteToPlainText(latestHtml || currentHtml)) !== result.sourceHash) {
        showToast({ message: '内容已变化，请重新整理', variant: 'error' }); return;
      }
      Keyboard.dismiss();
      setRewrite({ sourceText: plainText, result });
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : 'AI 整理失败', variant: 'error' });
    } finally { setAiBusy(false); }
  }, [aiBusy, flushSave, preferences.aiEnabled, showToast]);

  const applyRewrite = useCallback(async (selectedIds: string[]) => {
    if (!rewrite) return;
    const before = await editorRef.current?.getContentHtml() || stickerRef.current?.content || '';
    if (computeContentHash(noteToPlainText(before)) !== rewrite.result.sourceHash ||
        /<(?:img|iframe|video|audio|object|embed)\b/i.test(before)) {
      setRewrite(null);
      showToast({ message: '内容已变化，请重新生成', variant: 'error' }); return;
    }
    const html = renderRewriteHtml(rewrite.result, selectedIds);
    const previousAi = stickerRef.current?.ai ?? null;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    try {
      await persistNow({ content: html, ai: null });
      editorRef.current?.setContentHTML(html);
      setRewriteUndo({ before, afterHash: computeContentHash(noteToPlainText(html)), ai: previousAi });
      setRewrite(null);
      if (paired) void syncNow().catch(() => {});
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : '应用整理失败', variant: 'error' });
    }
  }, [paired, persistNow, rewrite, showToast]);

  const undoRewrite = useCallback(async () => {
    if (!rewriteUndo) return;
    const html = await editorRef.current?.getContentHtml() || '';
    if (computeContentHash(noteToPlainText(html)) !== rewriteUndo.afterHash) {
      setRewriteUndo(null);
      showToast({ message: '内容已变化，无法撤销', variant: 'error' }); return;
    }
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    try {
      await persistNow({ content: rewriteUndo.before, ai: rewriteUndo.ai });
      editorRef.current?.setContentHTML(rewriteUndo.before);
      setRewriteUndo(null);
      if (paired) void syncNow().catch(() => {});
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : '撤销失败', variant: 'error' });
    }
  }, [paired, persistNow, rewriteUndo, showToast]);

  const handleSetReminder = useCallback(
    async (iso: string) => {
      if (Date.parse(iso) <= Date.now()) {
        showToast({ message: '提醒时间已过，请重新选择', variant: 'error' });
        return;
      }
      try {
        const permitted = await requestReminderPermission();
        await persistNow({ reminder: iso, reminderTriggered: false });
        await reconcileReminders();
        showToast({ message: permitted ? '提醒已设置' : '时间已保存，请开启系统通知',
          variant: permitted ? 'success' : 'info' });
        setSheetVisible(false);
      } catch {
        showToast({ message: '提醒设置失败，请重试', variant: 'error' });
      }
    },
    [persistNow, showToast]
  );

  if (!sticker || editorFontCss === null) {
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
          subtitle={
            aiBusy
              ? 'AI 整理中…'
              : saveStatus === 'saving'
                ? '保存中…'
                : hasFreshAI
                  ? '已保存 · 已整理'
                  : '已保存'
          }
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
                onPress={() => void runAI(false)}
                disabled={aiBusy}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {aiBusy ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Sparkles
                    size={18}
                    color={hasFreshAI ? theme.colors.accent : theme.colors.textMuted}
                  />
                )}
              </Pressable>
              <Pressable
                onPress={() => setManageVisible(true)}
                accessibilityLabel="管理便签"
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ellipsis size={19} color={theme.colors.textMuted} />
              </Pressable>
            </>
          }
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          paddingHorizontal: theme.spacing.lg, paddingVertical: 8 }}>
          <Pressable onPress={() => void runRewrite()} disabled={aiBusy} accessibilityRole="button"
            style={{ paddingVertical: 4 }}>
            <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '600' }}>AI 整理并补充</Text>
          </Pressable>
          <Pressable onPress={() => void openPreview()} accessibilityRole="button">
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>查看标注</Text>
          </Pressable>
          {paired && <Pressable onPress={() => void handleSync()} disabled={syncing} accessibilityRole="button">
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{syncing ? '同步中...' : '同步'}</Text>
          </Pressable>}
          {rewriteUndo && <Pressable onPress={() => void undoRewrite()} accessibilityRole="button"
            style={{ paddingVertical: 4 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>撤销本次整理</Text>
          </Pressable>}
        </View>

        {(sticker.tasks?.length ?? 0) > 0 && (
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 8, gap: 7 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
              待办 {sticker.tasks?.filter((task) => task.done).length}/{sticker.tasks?.length}
            </Text>
            <ScrollView style={{ maxHeight: 140 }} contentContainerStyle={{ gap: 7 }}>
            {sticker.tasks?.map((task) => (
              <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Pressable onPress={() => void toggleTask(task.id)} accessibilityLabel={task.done ? '标为未完成' : '完成待办'}
                  style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1,
                    borderColor: theme.colors.accent, backgroundColor: task.done ? theme.colors.accent : 'transparent',
                    alignItems: 'center', justifyContent: 'center' }}>
                  {task.done && <Check size={15} color={theme.colors.onAccent} />}
                </Pressable>
                <Text style={{ flex: 1, color: task.done ? theme.colors.textMuted : theme.colors.text,
                  textDecorationLine: task.done ? 'line-through' : 'none', fontSize: 13 }} numberOfLines={2}>{task.text}</Text>
                <Pressable onPress={() => void removeTask(task.id)} accessibilityLabel="移除待办">
                  <X size={15} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            ))}
            </ScrollView>
          </View>
        )}

        <View
          style={{
            flex: 1,
            marginHorizontal: theme.spacing.md,
            marginTop: theme.spacing.sm + 2,
            marginBottom: insets.bottom + theme.spacing.sm,
            borderRadius: theme.radius.xl,
            overflow: 'hidden',
            backgroundColor: noteBg,
            shadowColor: theme.colors.shadow,
            shadowOpacity: theme.skin === 'glass' ? (theme.dark ? 0.1 : 0.04) : theme.skin === 'vellum' ? 0.16 : 0.12,
            shadowRadius: theme.skin === 'glass' ? 12 : 18,
            shadowOffset: { width: 0, height: theme.skin === 'glass' ? 4 : 8 },
            elevation: theme.skin === 'glass' ? 1 : 5,
            borderWidth: theme.skin === 'glass' ? 1 : 0,
            borderColor: glass?.border ?? theme.colors.border,
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
                      backgroundColor: theme.skin === 'glass'
                        ? resolveGlassCardColor(item.color, theme.dark).tint
                        : theme.dark ? item.darkColor : item.color,
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

          {/* 固定编辑器高度，让长正文在 WebView 内滚动。 */}
          <RichEditor
            ref={editorRef}
            useContainer={false}
            scrollEnabled
            nestedScrollEnabled
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
              initialCSSText: editorFontCss,
              contentCSSText: `font-family: '${APP_FONT_FAMILY}', Arial, sans-serif; font-size: 15px; line-height: 1.7; color: ${noteText}; padding-bottom: 88px;${doodleUri ? ` background-image: url("${doodleUri}"); background-repeat: no-repeat; background-position: right 8px bottom 12px; background-size: 210px auto;` : ''}`,
            }}
            placeholder="开始输入..."
          />
          <GrainOverlay />
        </View>

      </View>

      <AiResultSheet
        visible={sheetVisible}
        annotation={sticker.ai}
        currentTags={sticker.tags}
        currentTasks={sticker.tasks ?? []}
        hasReminder={!!sticker.reminder}
        rerunning={aiBusy}
        onClose={() => setSheetVisible(false)}
        onAdoptTag={(tag) => void handleAdoptTag(tag)}
        onAdoptAllTags={() => void handleAdoptAllTags()}
        onAdoptTodo={(text) => void handleAdoptTodo(text)}
        onSetReminder={(iso) => void handleSetReminder(iso)}
        onRerun={() => void runAI(true)}
      />
      <AiRewriteSheet result={rewrite?.result || null} sourceText={rewrite?.sourceText || ''}
        onClose={() => setRewrite(null)} onApply={(selected) => void applyRewrite(selected)} />

      <AnnotationPreview
        visible={previewVisible}
        plainText={previewText}
        annotation={sticker.ai}
        fresh={previewFresh}
        onClose={() => setPreviewVisible(false)}
        onRerun={() => {
          setPreviewVisible(false);
          void runAI(true);
        }}
      />
      <StickerManageSheet sticker={manageVisible ? sticker : null}
        onClose={() => setManageVisible(false)}
        onSave={async (partial) => {
          await flushSave();
          await persistNow(partial);
          await reconcileReminders().catch(() => {
            showToast({ message: '便签已保存，但通知安排失败', variant: 'error' });
          });
          if (paired) void syncNow().catch(() => {});
        }} onDelete={() => { setManageVisible(false); handleDelete(); }} />
    </ScreenBackground>
  );
}
