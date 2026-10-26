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
}

/** 玻璃/半透明表面：BlurView + 高光渐变 + 发丝边 + 阴影 */
export function GlassSurface({
  children,
  style,
  contentStyle,
  blur = true,
  radius = 20,
  intensity,
}: GlassSurfaceProps) {
  const theme = useAppTheme();
  const targetRef = useContext(BlurTargetContext);

  return (
    <View
      style={[
        styles.base,
        {
          borderRadius: radius,
          borderColor: theme.colors.border,
          backgroundColor: blur ? 'transparent' : theme.colors.surfaceCard,
          shadowColor: theme.dark ? '#000000' : '#0F172A',
        },
        style,
      ]}
    >
      {blur ? (
        <BlurView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint={theme.colors.glassTint}
          intensity={intensity ?? theme.colors.glassIntensity}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          blurTarget={targetRef ?? undefined}
        />
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={
          theme.dark
            ? blur
              ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)']
              : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']
            : blur
              ? ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.18)']
              : ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.05)']
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
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
});
