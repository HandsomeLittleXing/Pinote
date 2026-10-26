import React from 'react';
import { Pressable, TextInput } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { GlassSurface } from './GlassSurface';
import { useAppTheme } from '../theme';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

/** 玻璃搜索框 */
export function SearchField({
  value,
  onChangeText,
  placeholder = '搜索便签...',
}: SearchFieldProps) {
  const theme = useAppTheme();

  return (
    <GlassSurface
      blur
      radius={theme.radius.lg}
      style={{ width: '100%' }}
      contentStyle={{
        height: 46,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
      }}
    >
      <Search size={17} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSubtle}
        selectionColor={theme.colors.accent}
        returnKeyType="search"
        style={{
          flex: 1,
          marginLeft: theme.spacing.sm,
          paddingVertical: 0,
          color: theme.colors.text,
          fontSize: theme.typography.body,
        }}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          style={{ padding: 4 }}
        >
          <X size={15} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </GlassSurface>
  );
}
