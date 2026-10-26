import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Bell, Pin } from 'lucide-react-native';
import { extractSnippet, extractTitle, getChecklistProgress } from '@shared/note';
import { resolveStickerColor } from '@shared/palette';
import type { Sticker } from '@shared/types';
import { GlassSurface } from './GlassSurface';
import { useAppTheme } from '../theme';
import { formatRelativeTime } from '../utils/time';

interface StickerCardProps {
  sticker: Sticker;
  onPress: () => void;
  onLongPress: () => void;
}

/** 列表便签卡片 */
export function StickerCard({ sticker, onPress, onLongPress }: StickerCardProps) {
  const theme = useAppTheme();
  const palette = resolveStickerColor(sticker.color);
  const dotColor = theme.dark ? palette.darkColor : palette.color;
  const title = extractTitle(sticker.content);
  const snippet = extractSnippet(sticker.content, title, 90);
  const progress = getChecklistProgress(sticker.content);
  const progressWidth = `${Math.round(
    (progress.done / Math.max(progress.total, 1)) * 100
  )}%` as const;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        { opacity: pressed ? 0.92 : 1, flexGrow: 0, flexShrink: 0 },
      ]}
    >
      <GlassSurface
        blur={false}
        radius={theme.radius.lg}
        contentStyle={{ padding: theme.spacing.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: dotColor,
            }}
          />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: theme.colors.text,
              fontSize: theme.typography.title,
              fontWeight: '600',
            }}
          >
            {title}
          </Text>
          {sticker.isPinned ? <Pin size={14} color={theme.colors.accent} /> : null}
          {sticker.reminder && !sticker.reminderTriggered ? (
            <Bell size={14} color={theme.colors.warning} />
          ) : null}
          <Text
            style={{
              color: theme.colors.textSubtle,
              fontSize: theme.typography.caption,
            }}
          >
            {formatRelativeTime(sticker.updatedAt)}
          </Text>
        </View>

        {snippet ? (
          <Text
            numberOfLines={2}
            style={{
              marginTop: 6,
              color: theme.colors.textMuted,
              fontSize: theme.typography.body,
              lineHeight: 19,
            }}
          >
            {snippet}
          </Text>
        ) : null}

        {progress.total > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <View
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.border,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: progressWidth,
                  height: '100%',
                  backgroundColor: theme.colors.accent,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: theme.typography.caption,
                color: theme.colors.textSubtle,
              }}
            >
              {progress.done}/{progress.total}
            </Text>
          </View>
        ) : null}

        {sticker.tags.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 8,
            }}
          >
            {sticker.tags.slice(0, 3).map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: theme.colors.accentSoft,
                  borderRadius: 6,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ color: theme.colors.accent, fontSize: 10 }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </GlassSurface>
    </Pressable>
  );
}
