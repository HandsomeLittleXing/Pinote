import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { STICKER_DOODLES, type StickerDoodleName } from '@shared/stickerDoodles';
import { useAppTheme } from '../theme';

const placements: Array<{ name: StickerDoodleName; size: number; style: ViewStyle }> = [
  { name: 'cup', size: 118, style: { top: '12%', right: -23, transform: [{ rotate: '-10deg' }] } },
  { name: 'star', size: 55, style: { top: '33%', left: -10, transform: [{ rotate: '14deg' }] } },
  { name: 'buddy', size: 106, style: { top: '56%', left: -25, transform: [{ rotate: '7deg' }] } },
  { name: 'flower', size: 92, style: { bottom: '6%', right: -20, transform: [{ rotate: '-8deg' }] } },
  { name: 'leaf', size: 72, style: { top: '42%', right: -16, transform: [{ rotate: '15deg' }] } },
  { name: 'cat', size: 80, style: { bottom: '-3%', left: '24%', transform: [{ rotate: '-8deg' }] } },
];

/** 放在内容下方的少量手绘线稿，只作装饰，不参与点击与朗读。 */
export function StickerDoodles() {
  const theme = useAppTheme();
  const ink = theme.dark ? '#F0E8D5' : '#26352A';

  return (
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      {placements.map(({ name, size, style }) => (
        <View key={name} style={[{ position: 'absolute', width: size, height: size, opacity: theme.dark ? 0.24 : 0.22 }, style]}>
          <Svg width="100%" height="100%" viewBox={STICKER_DOODLES[name].viewBox} fill="none">
            {STICKER_DOODLES[name].paths.map((path, index) => (
              <Path key={index} d={path} stroke={ink} strokeWidth={3.5}
                strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        </View>
      ))}
    </View>
  );
}
