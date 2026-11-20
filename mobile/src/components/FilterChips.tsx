import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from './AppText';
import { useAppTheme } from '../theme';

export interface FilterOption {
  key: string;
  label: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  value: string;
  onChange: (key: string) => void;
}

/** 横向筛选 chips */
export function FilterChips({ options, value, onChange }: FilterChipsProps) {
  const theme = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const tags = options.filter((item) => item.key.startsWith('tag:'));
  const shown = tags.slice(0, 4);
  const activeTag = tags.find((item) => item.key === value);
  if (activeTag && !shown.some((item) => item.key === value)) shown.push(activeTag);
  const visibleOptions = options.filter((item) => !item.key.startsWith('tag:'));
  visibleOptions.splice(1, 0, ...shown);
  const hidden = tags.filter((item) => !shown.some((shownItem) => shownItem.key === item.key));

  return (
    <>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: 2 }}
    >
      {visibleOptions.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: active ? theme.colors.accent : theme.colors.border,
                backgroundColor: active
                  ? theme.colors.accent
                  : theme.colors.surfaceGlass,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
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
      {hidden.length > 0 && <Pressable onPress={() => setMenuOpen(true)} style={[styles.chip,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceGlass }]}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>更多标签</Text>
      </Pressable>}
    </ScrollView>
    <Modal visible={menuOpen} animationType="slide" onRequestClose={() => setMenuOpen(false)}>
      <View style={{ flex: 1, backgroundColor: theme.colors.backgroundStart, padding: theme.spacing.lg }}>
        <Pressable onPress={() => setMenuOpen(false)} style={{ alignSelf: 'flex-end', padding: 8 }}>
          <Text style={{ color: theme.colors.accent }}>关闭</Text>
        </Pressable>
        <TextInput value={query} onChangeText={setQuery} placeholder="搜索标签"
          placeholderTextColor={theme.colors.textSubtle}
          style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
            color: theme.colors.text, padding: 10, marginBottom: 12 }} />
        <ScrollView>{hidden.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
          .map((item) => <Pressable key={item.key} onPress={() => { onChange(item.key); setMenuOpen(false); }}
            style={{ padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border }}>
            <Text style={{ color: theme.colors.text }}>{item.label}</Text>
          </Pressable>)}</ScrollView>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
