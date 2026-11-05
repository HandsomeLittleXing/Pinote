import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Eye, Sparkles, X } from 'lucide-react-native';
import { ANNOTATION_META, ANNOTATION_KINDS } from '@shared/ai';
import type { AIAnnotation } from '@shared/types';
import { useAppTheme } from '../theme';
import { AnnotatedText } from './AnnotatedText';

interface AnnotationPreviewProps {
  visible: boolean;
  plainText: string;
  annotation: AIAnnotation | null;
  fresh: boolean;
  onClose: () => void;
  onRerun: () => void;
}

/** 只读注解预览：手机上不往 WebView 注入高亮，正文保持纯净 */
export function AnnotationPreview({
  visible,
  plainText,
  annotation,
  fresh,
  onClose,
  onRerun,
}: AnnotationPreviewProps) {
  const theme = useAppTheme();
  const counts = React.useMemo(() => {
    const result: Record<string, number> = {};
    for (const span of fresh ? annotation?.spans ?? [] : []) {
      result[span.kind] = (result[span.kind] ?? 0) + 1;
    }
    return result;
  }, [annotation, fresh]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' }} onPress={onClose} />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '82%',
          backgroundColor: theme.colors.surfaceCard,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.sm,
          }}
        >
          <Eye size={18} color={theme.colors.accent} />
          <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
            注解预览
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: 36,
            gap: theme.spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          {!annotation ? (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
              <Sparkles size={28} color={theme.colors.textSubtle} />
              <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                还没有 AI 整理结果
              </Text>
              <Pressable
                onPress={onRerun}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.accent,
                }}
              >
                <Text style={{ color: theme.colors.onAccent, fontSize: 13, fontWeight: '600' }}>
                  立即整理
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {!fresh ? (
                <View
                  style={{
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.accentSoft,
                  }}
                >
                  <Text style={{ color: theme.colors.warning, fontSize: 12 }}>
                    正文已修改，当前 AI 结果可能过期。
                  </Text>
                </View>
              ) : null}

              {fresh && annotation.summary ? (
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 15,
                    lineHeight: 22,
                    fontWeight: '600',
                  }}
                >
                  ✦ {annotation.summary}
                </Text>
              ) : null}

              {fresh && annotation.spans.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {ANNOTATION_KINDS.filter((kind) => counts[kind]).map((kind) => (
                    <View
                      key={kind}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
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
                    </View>
                  ))}
                </View>
              ) : null}

              <AnnotatedText
                text={plainText}
                spans={fresh ? annotation.spans : []}
                style={{
                  color: theme.colors.text,
                  fontSize: 15,
                  lineHeight: 25,
                }}
              />

              {fresh && annotation.tags.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                    AI 标签
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {annotation.tags.map((tag) => (
                      <View
                        key={tag}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 8,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: theme.colors.brandSecondary,
                        }}
                      >
                        <Text style={{ color: theme.colors.brandSecondary, fontSize: 11 }}>
                          ✦ {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={onRerun}
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.accentSoft,
                }}
              >
                <Sparkles size={13} color={theme.colors.accent} />
                <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '600' }}>
                  {fresh ? '重新整理' : '重新整理并更新'}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
