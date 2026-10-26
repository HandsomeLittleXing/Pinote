import React from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '../theme';
import { GlassSurface } from './GlassSurface';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** 空状态 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.xxl + 8,
      }}
    >
      <GlassSurface
        radius={999}
        style={{ width: 64, height: 64 }}
        contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        {icon}
      </GlassSurface>
      <Text
        style={{
          marginTop: theme.spacing.lg - 2,
          fontSize: theme.typography.title,
          fontWeight: '600',
          color: theme.colors.text,
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            marginTop: theme.spacing.sm - 2,
            maxWidth: 280,
            textAlign: 'center',
            fontSize: theme.typography.body,
            lineHeight: 20,
            color: theme.colors.textMuted,
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: theme.spacing.lg }}>{action}</View> : null}
    </View>
  );
}
