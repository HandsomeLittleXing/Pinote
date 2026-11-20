import React, { useContext } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme';
import { BlurTargetContext } from './ScreenBackground';

interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** false 时使用半透明实色（列表卡片等性能敏感区域） */
  blur?: boolean;
  radius?: number;
  intensity?: number;
  tint?: string;
}

/** 玻璃/半透明表面：BlurView + 高光渐变 + 发丝边 + 阴影 */
export function GlassSurface({
  children,
  style,
  contentStyle,
  blur = true,
  radius = 20,
  intensity,
  tint,
}: GlassSurfaceProps) {
  const theme = useAppTheme();
  const targetRef = useContext(BlurTargetContext);
  const isStickerSkin = theme.skin === 'glass';
  const useBlur = blur && !isStickerSkin;

  return (
    <View
      style={[
        styles.base,
        {
          borderRadius: isStickerSkin && radius !== 0 && radius !== 999 ? theme.radius.md : radius,
          borderWidth: isStickerSkin ? 1 : StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          backgroundColor: useBlur ? 'transparent' : theme.colors.surfaceCard,
          shadowColor: theme.colors.shadow,
          shadowOpacity: isStickerSkin ? (theme.dark ? 0.18 : 0.1) : 0.1,
          shadowRadius: isStickerSkin ? 7 : 18,
          shadowOffset: { width: 0, height: isStickerSkin ? 3 : 8 },
          elevation: isStickerSkin ? 2 : 4,
        },
        style,
      ]}
    >
      {useBlur ? (
        <BlurView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint={theme.colors.glassTint}
          intensity={intensity ?? theme.colors.glassIntensity}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          blurTarget={targetRef ?? undefined}
        />
      ) : null}

      {isStickerSkin && tint ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${tint}${theme.dark ? '22' : '16'}`, `${tint}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {!isStickerSkin && <LinearGradient
        pointerEvents="none"
        colors={
          useBlur
            ? [theme.colors.glassTop, theme.colors.glassBottom]
            : theme.dark
              ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']
              : ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.03)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />}

      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
