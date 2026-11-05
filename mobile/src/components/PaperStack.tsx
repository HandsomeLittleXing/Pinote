import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme';

interface PaperStackProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

/**
 * Vellum 皮肤的叠纸容器：两张偏移的“硫酸纸”放在主卡后面。
 * 叠层不加 elevation，主卡继续用不透明 surfaceCard，避免 Android 亮框瑕疵。
 */
export function PaperStack({ children, style, radius = 18 }: PaperStackProps) {
  const theme = useAppTheme();
  if (!theme.effects.layeredPaper) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View style={style}>
      <View
        pointerEvents="none"
        style={[
          styles.layer,
          {
            borderRadius: radius,
            backgroundColor: theme.dark
              ? 'rgba(230, 60, 136, 0.10)'
              : 'rgba(214, 47, 116, 0.07)',
            borderColor: theme.dark
              ? 'rgba(240, 166, 197, 0.16)'
              : 'rgba(214, 47, 116, 0.10)',
            transform: [{ rotate: '-1.1deg' }, { translateX: -3 }, { translateY: 3 }],
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.layer,
          {
            borderRadius: radius,
            backgroundColor: theme.dark
              ? 'rgba(159, 224, 196, 0.07)'
              : 'rgba(143, 216, 197, 0.09)',
            borderColor: theme.dark
              ? 'rgba(159, 224, 196, 0.14)'
              : 'rgba(143, 216, 197, 0.12)',
            transform: [{ rotate: '0.8deg' }, { translateX: 3 }, { translateY: 1 }],
          },
        ]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { zIndex: 1 },
});
