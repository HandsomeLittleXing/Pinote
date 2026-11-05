import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AIRewriteResponse } from '@shared/types';
import { useAppTheme } from '../theme';

interface Props {
  result: AIRewriteResponse | null;
  sourceText: string;
  onClose: () => void;
  onApply: (selectedIds: string[]) => void;
}

export function AiRewriteSheet({ result, sourceText, onClose, onApply }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'source' | 'organized'>('organized');
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { setSelected(result?.supplements.map((item) => item.id) || []); }, [result]);
  const toggle = (id: string) => setSelected((current) => current.includes(id)
    ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <Modal visible={!!result} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.backgroundStart, padding: theme.spacing.lg,
        paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700' }}>AI 整理并补充</Text>
          <Pressable onPress={onClose}><Text style={{ color: theme.colors.textMuted }}>关闭</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(['source', 'organized'] as const).map((item) => <Pressable key={item} onPress={() => setView(item)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.md,
              backgroundColor: view === item ? theme.colors.accent : theme.colors.surface }}>
            <Text style={{ color: view === item ? theme.colors.onAccent : theme.colors.textMuted }}>{item === 'source' ? '原文' : '整理稿'}</Text>
          </Pressable>)}
        </View>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
          {view === 'source' ? <Text style={{ color: theme.colors.text, lineHeight: 22 }}>{sourceText}</Text>
            : result?.organizedBlocks.map((block, index) => <Text key={index}
                style={{ color: theme.colors.text, lineHeight: 22, fontWeight: block.type === 'heading' ? '700' : '400' }}>
                {block.type === 'bullet' ? '• ' : ''}{block.text}
              </Text>)}
          {!!result?.supplements.length && <View style={{ gap: 8, marginTop: 12 }}>
            <Text style={{ color: theme.colors.textMuted, fontWeight: '600' }}>AI 补充建议</Text>
            {result.supplements.map((item) => <Pressable key={item.id} onPress={() => toggle(item.id)}
              style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}>
              <Text style={{ color: theme.colors.accent }}>{selected.includes(item.id) ? '☑' : '□'}</Text>
              <Text style={{ flex: 1, color: theme.colors.text, lineHeight: 20 }}>{item.text}</Text>
            </Pressable>)}
          </View>}
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>应用会替换原有富文本格式；请核对 AI 整理和补充内容。</Text>
        </ScrollView>
        <Pressable onPress={() => onApply(selected)} style={{ alignItems: 'center', padding: 13,
          borderRadius: theme.radius.md, backgroundColor: theme.colors.accent }}>
          <Text style={{ color: theme.colors.onAccent, fontWeight: '600' }}>{selected.length ? '应用整理与补充' : '只应用整理'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
