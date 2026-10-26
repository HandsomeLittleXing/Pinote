import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

export type SyncBadgeStatus = 'synced' | 'syncing' | 'error' | 'offline';

const statusConfig: Record<
  SyncBadgeStatus,
  { label: string; color: 'success' | 'accent' | 'danger' | 'textMuted' }
> = {
  synced: { label: '已同步', color: 'success' },
  syncing: { label: '同步中', color: 'accent' },
  error: { label: '同步异常', color: 'danger' },
  offline: { label: '未同步', color: 'textMuted' },
};

interface StatusBadgeProps {
  status: SyncBadgeStatus;
  label?: string;
}

/** 同步状态徽标 */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const theme = useAppTheme();
  const config = statusConfig[status];
  const color = theme.colors[config.color];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: theme.colors.surfaceGlass,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }}
      />
      <Text style={{ fontSize: 10, fontWeight: '500', color }}>
        {label ?? config.label}
      </Text>
    </View>
  );
}
