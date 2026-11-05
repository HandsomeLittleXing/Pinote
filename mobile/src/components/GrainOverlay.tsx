import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useAppTheme } from '../theme';

/** 静态低对比颗粒层，不参与动画或触摸。 */
export function GrainOverlay() {
  const theme = useAppTheme();
  if (!theme.effects.grain) return null;

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="frostnote-grain" width="42" height="42" patternUnits="userSpaceOnUse">
          <Circle cx="4" cy="7" r="0.8" fill={theme.colors.text} fillOpacity={0.55} />
          <Circle cx="18" cy="14" r="0.6" fill={theme.colors.text} fillOpacity={0.4} />
          <Circle cx="31" cy="5" r="0.7" fill={theme.colors.text} fillOpacity={0.45} />
          <Circle cx="9" cy="28" r="0.6" fill={theme.colors.text} fillOpacity={0.35} />
          <Circle cx="25" cy="33" r="0.8" fill={theme.colors.text} fillOpacity={0.5} />
          <Circle cx="38" cy="23" r="0.5" fill={theme.colors.text} fillOpacity={0.35} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#frostnote-grain)" opacity={theme.skin === 'glass' ? 0.02 : 0.05} />
    </Svg>
  );
}
