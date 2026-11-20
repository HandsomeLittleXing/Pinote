import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './AppText';
import { Bell, Pin } from 'lucide-react-native';
import { extractSnippet, extractTitle, getChecklistProgress } from '@shared/note';
import { isAIUsable, noteToPlainText } from '@shared/ai';
import { resolveGlassCardColor, resolveStickerColor } from '@shared/palette';
import type { Sticker } from '@shared/types';
import { GlassSurface } from './GlassSurface';
import { PaperStack } from './PaperStack';
import { AnnotatedText } from './AnnotatedText';
import { useAppTheme, useThemeController } from '../theme';
import Svg, { Path } from 'react-native-svg';
import { getStickerDoodleForId, getStickerScatterVariant, STICKER_DOODLES } from '@shared/stickerDoodles';
import { formatRelativeTime } from '../utils/time';

interface StickerCardProps {
  sticker: Sticker;
  variant?: 'featured' | 'compact' | 'standard';
  onPress: () => void;
  onLongPress: () => void;
}

const SCATTER_POSES = [
  { angle: '-1.6deg', x: -2, y: 0, minHeight: 172, doodleSize: 108 },
  { angle: '1.7deg', x: 3, y: 7, minHeight: 188, doodleSize: 102 },
  { angle: '0.9deg', x: 2, y: 3, minHeight: 178, doodleSize: 114 },
  { angle: '-2deg', x: -3, y: 9, minHeight: 194, doodleSize: 106 },
  { angle: '-1.1deg', x: -2, y: 5, minHeight: 184, doodleSize: 110 },
  { angle: '1.4deg', x: 3, y: 1, minHeight: 174, doodleSize: 104 },
] as const;

/** 列表便签卡片 */
export function StickerCard({ sticker, variant = 'standard', onPress, onLongPress }: StickerCardProps) {
  const theme = useAppTheme();
  const { preferences } = useThemeController();
  const palette = resolveStickerColor(sticker.color);
  const glass = theme.skin === 'glass' ? resolveGlassCardColor(sticker.color, theme.dark) : null;
  const doodle = glass ? STICKER_DOODLES[getStickerDoodleForId(sticker.id)] : null;
  const pose = SCATTER_POSES[getStickerScatterVariant(sticker.id)];
  const featured = glass !== null && variant === 'featured';
  const compact = glass !== null && variant === 'compact';
  const dotColor = glass?.tint ?? (theme.dark ? palette.darkColor : palette.color);
  const cardInk = glass?.ink ?? theme.colors.text;
  const cardMuted = theme.colors.textMuted;
  const cardSubtle = theme.colors.textSubtle;
  const cardAccent = theme.colors.accent;
  const title = extractTitle(sticker.content);
  const snippet = extractSnippet(sticker.content, title, 90);
  const contentProgress = getChecklistProgress(sticker.content);
  const progress = {
    total: contentProgress.total + (sticker.tasks?.length ?? 0),
    done: contentProgress.done + (sticker.tasks?.filter((task) => task.done).length ?? 0),
  };
  const plainText = noteToPlainText(sticker.content);
  const freshAI = isAIUsable(sticker.ai, plainText) ? sticker.ai : null;
  const spans = freshAI?.spans ?? [];
  const summary = freshAI?.summary && preferences.showAiSummary ? freshAI.summary : null;
  const aiTags =
    freshAI && preferences.showAiTags
      ? freshAI.tags.filter((tag) => !sticker.tags.includes(tag)).slice(0, compact ? (sticker.tags.length ? 0 : 1) : 2)
      : [];
  const compactPreview = summary ?? snippet;
  const progressWidth = `${Math.round(
    (progress.done / Math.max(progress.total, 1)) * 100
  )}%` as const;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        { opacity: pressed ? 0.92 : 1, flexShrink: 0 },
      ]}
    >
      <PaperStack radius={theme.radius.lg}>
        <GlassSurface
          blur={false}
          radius={theme.radius.lg}
          tint={glass?.tint}
          style={glass ? {
            backgroundColor: glass.surface,
            borderColor: glass.border,
            borderWidth: 1.5,
            overflow: 'hidden',
            minHeight: featured ? (summary || snippet ? 206 : 120) : compact ? pose.minHeight : undefined,
            transform: featured ? [{ rotate: pose.angle }] : compact
              ? [{ translateX: pose.x }, { translateY: pose.y }, { rotate: pose.angle }]
              : undefined,
          } : undefined}
          contentStyle={{
            padding: compact ? 12 : featured ? 18 : theme.spacing.lg,
            minHeight: compact ? pose.minHeight - 24 : undefined,
            flex: featured || compact ? 1 : undefined,
          }}
        >
        {doodle && (
          <View pointerEvents="none" accessible={false} style={{
            position: 'absolute',
            right: featured ? 8 : 2,
            bottom: featured ? -8 : 2,
            width: featured ? 155 : pose.doodleSize,
            height: featured ? 155 : pose.doodleSize,
            opacity: theme.dark ? 0.17 : 0.16,
          }}>
            <Svg width="100%" height="100%" viewBox={doodle.viewBox} fill="none">
              {doodle.paths.map((path, index) => (
                <Path key={index} d={path} stroke={cardInk} strokeWidth={3.8}
                  strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: featured || compact ? 'flex-start' : 'center', gap: 8 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: dotColor,
              marginTop: featured ? 9 : compact ? 5 : 0,
            }}
          />
          <AnnotatedText
            text={title}
            spans={spans}
            annotationInk={glass?.ink}
            numberOfLines={featured || compact ? 2 : 1}
            style={{
              flex: 1,
              color: cardInk,
              fontSize: featured ? 19 : compact ? 14 : theme.typography.title,
              fontWeight: '600',
            }}
          />
          {sticker.isPinned ? <Pin size={14} color={cardAccent} /> : null}
          {sticker.reminder && !sticker.reminderTriggered && Date.parse(sticker.reminder) > Date.now() ? (
            <Bell size={14} color={theme.colors.warning} />
          ) : null}
          {!featured && !compact ? (
            <Text style={{ color: theme.colors.textSubtle, fontSize: theme.typography.caption }}>
              {formatRelativeTime(sticker.updatedAt)}
            </Text>
          ) : null}
        </View>

        <View style={featured ? {
          flex: 1,
          justifyContent: 'center',
          gap: 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.borderStrong,
          marginVertical: 12,
          paddingVertical: 10,
        } : compact ? { flex: 1, justifyContent: 'center', gap: 8, marginTop: 8 } : undefined}>
          {compact && compactPreview ? (
            summary ? (
              <Text numberOfLines={2} style={{ color: cardMuted, fontSize: 12, lineHeight: 17 }}>
                {compactPreview}
              </Text>
            ) : (
              <AnnotatedText
                text={compactPreview}
                spans={spans}
                annotationInk={glass?.ink}
                numberOfLines={2}
                style={{ color: cardMuted, fontSize: 12, lineHeight: 17 }}
              />
            )
          ) : null}

          {!compact && summary ? (
            <Text
              numberOfLines={featured ? 2 : 1}
              style={{
                marginTop: featured ? 0 : 6,
                color: featured ? cardMuted : cardInk,
                fontSize: featured ? 14 : theme.typography.body,
                lineHeight: featured ? 21 : 19,
              }}
            >
              <Text style={{ color: cardAccent, fontWeight: '700' }}>✦ </Text>
              {summary}
            </Text>
          ) : null}

          {!compact && snippet ? (
            <AnnotatedText
              text={snippet}
              spans={spans}
              annotationInk={glass?.ink}
              numberOfLines={featured ? 3 : summary ? 1 : 2}
              style={{
                marginTop: featured ? 0 : summary ? 4 : 6,
                color: cardMuted,
                fontSize: featured ? 14 : theme.typography.body,
                lineHeight: featured ? 21 : 19,
              }}
            />
          ) : null}

          {progress.total > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: compact || featured ? 0 : 8 }}>
              <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
                <View style={{ width: progressWidth, height: '100%', backgroundColor: cardAccent }} />
              </View>
              <Text style={{ fontSize: theme.typography.caption, color: cardSubtle }}>
                {progress.done}/{progress.total}
              </Text>
            </View>
          ) : null}
        </View>

        {sticker.tags.length > 0 || aiTags.length > 0 || featured || compact ? (
        <View style={featured || compact ? { flexDirection: 'row', alignItems: 'flex-end', gap: 8 } : undefined}>
          <View style={{ flex: featured || compact ? 1 : undefined, flexDirection: 'row', flexWrap: compact ? 'nowrap' : 'wrap', gap: 6, marginTop: featured || compact ? 0 : 8 }}>
            {sticker.tags.slice(0, compact ? 1 : 3).map((tag) => (
              <View
                key={tag}
                style={{
                  maxWidth: compact ? 82 : undefined,
                  backgroundColor: theme.colors.accentSoft,
                  borderRadius: theme.radius.sm,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}
              >
                <Text numberOfLines={1} style={{ color: cardAccent, fontSize: 10 }}>
                  {tag}
                </Text>
              </View>
            ))}
            {aiTags.map((tag) => (
              <View
                key={`ai-${tag}`}
                style={{
                  maxWidth: compact ? 82 : undefined,
                  borderRadius: theme.radius.sm,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.colors.accent2,
                }}
              >
                <Text numberOfLines={1} style={{ color: theme.colors.accent2, fontSize: 10 }}>
                  ✦ {tag}
                </Text>
              </View>
            ))}
          </View>
          {featured || compact ? (
            <Text numberOfLines={1} style={{ color: cardSubtle, fontSize: 10 }}>
              {formatRelativeTime(sticker.updatedAt)}
            </Text>
          ) : null}
        </View>
        ) : null}
        </GlassSurface>
      </PaperStack>
    </Pressable>
  );
}
