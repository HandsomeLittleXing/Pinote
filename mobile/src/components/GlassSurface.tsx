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
  const useBlur =
    blur && !(theme.skin === 'glass' && Platform.OS === 'android' && Number(Platform.Version) < 31);
  const isLightGlass = theme.skin === 'glass';

  return (
    <View
      style={[
        styles.base,
        {
          borderRadius: isLightGlass && radius !== 0 && radius !== 999 ? theme.radius.md : radius,
          borderColor: theme.colors.border,
          backgroundColor: useBlur ? 'transparent' : theme.colors.surfaceCard,
          shadowColor: theme.colors.shadow,
          shadowOpacity: isLightGlass ? (theme.dark ? 0.1 : 0.04) : 0.1,
          shadowRadius: isLightGlass ? 12 : 18,
          shadowOffset: { width: 0, height: isLightGlass ? 4 : 8 },
          elevation: isLightGlass ? 1 : 4,
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

      {isLightGlass && tint ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${tint}${theme.dark ? '38' : '55'}`, `${tint}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={
          useBlur
            ? [theme.colors.glassTop, theme.colors.glassBottom]
            : isLightGlass
              ? theme.dark
                ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.00)']
                : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.00)']
            : theme.dark
              ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']
              : ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.03)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

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
