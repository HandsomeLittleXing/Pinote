import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import { Text, TextInput } from './AppText';
import { Bell, Pin, Tag, Trash2, X } from 'lucide-react-native';
import type { Sticker } from '@shared/types';
import { requestReminderPermission } from '../notifications/reminders';
import { useAppTheme } from '../theme';

interface Props {
  sticker: Sticker | null;
  onClose: () => void;
  onSave: (partial: Partial<Sticker>) => Promise<void>;
  onDelete: () => void;
}

function formatInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseInput(value: string): string | null {
  if (!value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error('请输入 YYYY-MM-DD HH:mm 格式');
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
      date.getHours() !== hour || date.getMinutes() !== minute || date.getTime() <= Date.now()) {
    throw new Error('请选择有效的未来时间');
  }
  return date.toISOString();
}

export function StickerManageSheet({ sticker, onClose, onSave, onDelete }: Props) {
  const theme = useAppTheme();
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState('');
  const [reminder, setReminder] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPinned(!!sticker?.isPinned);
    setTags(sticker?.tags.join('、') ?? '');
    setReminder(formatInput(sticker?.reminder ?? null));
  }, [sticker?.id]);

  const save = async () => {
    if (!sticker || busy) return;
    try {
      const parsedReminder = reminder.trim() === formatInput(sticker.reminder)
        ? sticker.reminder : parseInput(reminder);
      const parsedTags = [...new Set(tags.split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean))];
      if (parsedTags.length > 3 || parsedTags.some((tag) => tag.length > 12)) {
        throw new Error('最多 3 个标签，每个不超过 12 字');
      }
      if (parsedReminder && parsedReminder !== sticker.reminder && !(await requestReminderPermission())) {
        Alert.alert('通知未开启', '提醒时间会保存，但系统通知权限未开启。请在系统设置中允许通知。');
      }
      setBusy(true);
      await onSave({ isPinned: pinned, tags: parsedTags, reminder: parsedReminder,
        reminderTriggered: parsedReminder === sticker.reminder ? sticker.reminderTriggered : false });
      onClose();
    } catch (error) {
      Alert.alert('无法保存', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const setPreset = (kind: 'half' | 'hour' | 'tomorrow') => {
    const date = new Date();
    if (kind === 'tomorrow') {
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
    } else {
      date.setMinutes(date.getMinutes() + (kind === 'half' ? 30 : 60));
    }
    setReminder(formatInput(date.toISOString()));
  };

  return (
    <Modal visible={!!sticker} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' }} />
      <View style={{ backgroundColor: theme.colors.surfaceCard, padding: 20, maxHeight: '82%',
        paddingBottom: 36, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ flex: 1, color: theme.colors.text, fontSize: 17, fontWeight: '700' }}>管理便签</Text>
          <Pressable onPress={onClose} accessibilityLabel="关闭管理"><X size={20} color={theme.colors.textMuted} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pin size={18} color={theme.colors.accent} />
            <Text style={{ flex: 1, color: theme.colors.text }}>置顶便签</Text>
            <Switch value={pinned} onValueChange={setPinned} />
          </View>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Tag size={18} color={theme.colors.accent} />
              <Text style={{ color: theme.colors.text }}>标签</Text>
            </View>
            <TextInput value={tags} onChangeText={setTags} placeholder="用顿号分隔，最多 3 个"
              placeholderTextColor={theme.colors.textSubtle}
              style={{ color: theme.colors.text, backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.sm,
                paddingHorizontal: 12, paddingVertical: 10 }} />
          </View>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Bell size={18} color={theme.colors.accent} />
              <Text style={{ color: theme.colors.text }}>提醒时间</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(['half', 'hour', 'tomorrow'] as const).map((kind, index) => (
                <Pressable key={kind} onPress={() => setPreset(kind)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.sm,
                    backgroundColor: theme.colors.accentSoft }}>
                  <Text style={{ color: theme.colors.accent, fontSize: 12 }}>{['30 分钟后', '1 小时后', '明天 9 点'][index]}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={reminder} onChangeText={setReminder} placeholder="YYYY-MM-DD HH:mm；清空即可取消"
              placeholderTextColor={theme.colors.textSubtle}
              keyboardType="numbers-and-punctuation"
              style={{ color: theme.colors.text, backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.sm,
                paddingHorizontal: 12, paddingVertical: 10 }} />
          </View>
          <Pressable onPress={() => void save()} disabled={busy}
            style={{ backgroundColor: theme.colors.accent, padding: 13, borderRadius: theme.radius.sm,
              alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: theme.colors.onAccent, fontWeight: '600' }}>{busy ? '保存中...' : '保存'}</Text>
          </Pressable>
          <Pressable onPress={onDelete} style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, padding: 8 }}>
            <Trash2 size={16} color={theme.colors.danger} />
            <Text style={{ color: theme.colors.danger }}>删除便签</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
