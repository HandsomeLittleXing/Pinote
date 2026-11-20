import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import { GlassSurface } from './GlassSurface';

interface GlassHeaderProps {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

/** 安全区玻璃标题栏 */
export function GlassHeader({ title, subtitle, left, right }: GlassHeaderProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top }}>
      <GlassSurface
        radius={0}
        style={{
          borderWidth: 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          elevation: 0,
          shadowOpacity: 0,
        }}
        contentStyle={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
        }}
      >
        {left}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: theme.typography.title,
                fontWeight: '600',
                color: theme.colors.text,
              }}
            >
              {title}
            </Text>
          </View>
          {subtitle ? (
            <Text
              style={{
                marginTop: 2,
                fontSize: theme.typography.caption,
                color: theme.colors.textMuted,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            {right}
          </View>
        ) : null}
      </GlassSurface>
    </View>
  );
}
