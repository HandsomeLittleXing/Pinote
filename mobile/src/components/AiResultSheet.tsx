import React from 'react';
import { visibleAiTags } from '@shared/ai';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './AppText';
import { Check, Clock3, Sparkles, X } from 'lucide-react-native';
import { ANNOTATION_META, ANNOTATION_KINDS } from '@shared/ai';
import type { AIAnnotation, StickerTask } from '@shared/types';
import { useAppTheme } from '../theme';

interface AiResultSheetProps {
  visible: boolean;
  annotation: AIAnnotation | null;
  currentTags: string[];
  currentTasks: StickerTask[];
  hasReminder: boolean;
  rerunning?: boolean;
  onClose: () => void;
  onAdoptTag: (tag: string) => void;
  onAdoptAllTags: () => void;
  onAdoptTodo: (text: string) => void;
  onSetReminder: (iso: string) => void;
  onRerun: () => void;
}

function formatDue(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** AI 整理结果底部弹层：摘要 / 标签 / 待办 / 提醒建议 */
export function AiResultSheet({
  visible,
  annotation,
  currentTags,
  currentTasks,
  hasReminder,
  rerunning,
  onClose,
  onAdoptTag,
  onAdoptAllTags,
  onAdoptTodo,
  onSetReminder,
  onRerun,
}: AiResultSheetProps) {
  const theme = useAppTheme();

  const handleReminder = () => {
    const reminder = annotation?.suggestedReminder;
    if (!reminder?.dueAt) return;
    Alert.alert(
      '设置提醒',
      `将提醒时间设为 ${formatDue(reminder.dueAt)}？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '设置', onPress: () => onSetReminder(reminder.dueAt!) },
      ]
    );
  };

  const counts = React.useMemo(() => {
    const result: Record<string, number> = {};
    for (const span of annotation?.spans ?? []) {
      result[span.kind] = (result[span.kind] ?? 0) + 1;
    }
    return result;
  }, [annotation]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' }}
        onPress={onClose}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.surfaceCard,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          paddingBottom: 28,
          maxHeight: '76%',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.md,
          }}
        >
          <Sparkles size={18} color={theme.colors.accent} />
          <Text
            style={{
              flex: 1,
              color: theme.colors.text,
              fontSize: 16,
              fontWeight: '700',
            }}
          >
            AI 整理
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.lg,
            gap: theme.spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          {annotation?.summary ? (
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 15,
                lineHeight: 22,
                fontWeight: '600',
              }}
            >
              {annotation.summary}
            </Text>
          ) : null}

          {(annotation?.spans.length ?? 0) > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ANNOTATION_KINDS.filter((kind) => counts[kind]).map((kind) => (
                <View
                  key={kind}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: theme.annotations[kind].background,
                  }}
                >
                  <Text
                    style={{
                      color: theme.annotations[kind].color,
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    {ANNOTATION_META[kind].label}
                  </Text>
                  <Text
                    style={{
                      color: theme.annotations[kind].color,
                      fontSize: 10,
                      opacity: 0.8,
                    }}
                  >
                    {counts[kind]}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {(annotation?.tags.length ?? 0) > 0 ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  AI 标签
                </Text>
                <Pressable onPress={onAdoptAllTags} disabled={currentTags.length >= 3} hitSlop={6}>
                  <Text style={{ color: theme.colors.accent, fontSize: 12 }}>采纳可用建议</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {visibleAiTags(annotation?.tags || []).map((tag) => {
                  const adopted = currentTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => onAdoptTag(tag)}
                      disabled={!adopted && currentTags.length >= 3}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                        borderRadius: 8,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: adopted
                          ? theme.colors.accent
                          : theme.colors.brandSecondary,
                        backgroundColor: adopted
                          ? theme.colors.accentSoft
                          : 'transparent',
                      }}
                    >
                      {adopted ? (
                        <Check size={11} color={theme.colors.accent} />
                      ) : (
                        <Text style={{ color: theme.colors.brandSecondary, fontSize: 10 }}>✦</Text>
                      )}
                      <Text
                        style={{
                          color: adopted ? theme.colors.accent : theme.colors.text,
                          fontSize: 12,
                        }}
                      >
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {annotation?.suggestedReminder ? (
            <View
              style={{
                gap: 8,
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.accentSoft,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock3 size={14} color={theme.colors.accent} />
                <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                  提醒建议
                </Text>
              </View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                {annotation.suggestedReminder.text}
                {annotation.suggestedReminder.dueAt
                  ? ` · ${formatDue(annotation.suggestedReminder.dueAt)}`
                  : ''}
              </Text>
              {annotation.suggestedReminder.dueAt && !hasReminder ? (
                <Pressable
                  onPress={handleReminder}
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.accent,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.onAccent,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    设置提醒
                  </Text>
                </Pressable>
              ) : hasReminder ? (
                <Text style={{ color: theme.colors.textSubtle, fontSize: 11 }}>
                  当前便签已有提醒，未覆盖
                </Text>
              ) : null}
            </View>
          ) : null}

          {(annotation?.todos.length ?? 0) > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                待办
              </Text>
              {annotation?.todos.map((todo, index) => (
                <View key={`${todo}-${index}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.accent, fontSize: 13 }}>·</Text>
                  <Text style={{ flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>
                    {todo}
                  </Text>
                  <Pressable onPress={() => onAdoptTodo(todo)}
                    disabled={currentTasks.some((task) => task.text === todo)}
                    accessibilityLabel={`加入待办：${todo}`}
                    style={{ paddingHorizontal: 8, paddingVertical: 5 }}>
                    <Text style={{ color: theme.colors.accent, fontSize: 12 }}>
                      {currentTasks.some((task) => task.text === todo) ? '已加入' : '加入待办'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Pressable
              onPress={onRerun}
              disabled={rerunning}
              style={{
                flex: 1,
                paddingVertical: 11,
                borderRadius: theme.radius.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.border,
                alignItems: 'center',
                opacity: rerunning ? 0.6 : 1,
              }}
            >
              <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                {rerunning ? '整理中…' : '重新整理'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 11,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.accent,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: theme.colors.onAccent,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                完成
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
