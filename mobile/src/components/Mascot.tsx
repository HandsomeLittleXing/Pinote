import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../theme';

export type MascotMood = 'idle' | 'thinking' | 'happy' | 'sleepy';

interface MascotProps {
  size?: number;
  mood?: MascotMood;
  style?: StyleProp<ViewStyle>;
}

/**
 * 小墨：珠光墨团 + 会眨眼/看向随机方向的眼睛。
 * 只用 RN 内置 Animated（native driver），不逐帧改 SVG path。
 */
export function Mascot({ size = 48, mood = 'idle', style }: MascotProps) {
  const theme = useAppTheme();
  const breathe = useRef(new Animated.Value(1)).current;
  const eyeScale = useRef(new Animated.Value(1)).current;
  const lookX = useRef(new Animated.Value(0)).current;
  const lookY = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // 呼吸
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.04,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduceMotion]);

  // 眨眼 + 随机看方向
  useEffect(() => {
    if (reduceMotion) return;
    let blinkTimer: ReturnType<typeof setTimeout> | null = null;
    let lookTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const blink = () => {
      if (stopped) return;
      Animated.sequence([
        Animated.timing(eyeScale, { toValue: 0.12, duration: 90, useNativeDriver: true }),
        Animated.timing(eyeScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start(() => {
        if (!stopped) blinkTimer = setTimeout(blink, 3200 + Math.random() * 3800);
      });
    };

    const look = () => {
      if (stopped) return;
      const x = (Math.random() - 0.5) * 5;
      const y = (Math.random() - 0.5) * 4;
      Animated.parallel([
        Animated.spring(lookX, { toValue: x, useNativeDriver: true, speed: 8, bounciness: 2 }),
        Animated.spring(lookY, { toValue: y, useNativeDriver: true, speed: 8, bounciness: 2 }),
      ]).start();
      lookTimer = setTimeout(look, 1800 + Math.random() * 2600);
    };

    blinkTimer = setTimeout(blink, 1800);
    look();
    return () => {
      stopped = true;
      if (blinkTimer) clearTimeout(blinkTimer);
      if (lookTimer) clearTimeout(lookTimer);
    };
  }, [eyeScale, lookX, lookY, reduceMotion]);

  // 情绪覆盖
  useEffect(() => {
    if (mood === 'happy') {
      Animated.timing(eyeScale, { toValue: 0.42, duration: 160, useNativeDriver: true }).start();
    } else if (mood === 'sleepy') {
      Animated.timing(eyeScale, { toValue: 0.22, duration: 260, useNativeDriver: true }).start();
    } else if (mood === 'thinking') {
      Animated.parallel([
        Animated.timing(eyeScale, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(lookY, { toValue: -2.5, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(eyeScale, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    }
  }, [mood, eyeScale, lookY]);

  const eyeWidth = size * 0.19;
  const eyeHeight = size * 0.24;
  const pupilWidth = size * 0.085;
  const pupilHeight = size * 0.105;
  const eyeTop = size * 0.36;
  const side = size * 0.18;

  return (
    <View style={[styles.root, { width: size, height: size }, style]} pointerEvents="none">
      <Animated.View style={{ transform: [{ scale: breathe }] }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={`mote-${size}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={theme.colors.brandSecondary} stopOpacity={0.95} />
              <Stop offset="0.55" stopColor={theme.colors.brandPrimary} stopOpacity={0.75} />
              <Stop offset="1" stopColor={theme.colors.brandTertiary} stopOpacity={0.9} />
            </LinearGradient>
          </Defs>
          <Ellipse
            cx={size / 2}
            cy={size * 0.52}
            rx={size * 0.42}
            ry={size * 0.40}
            fill={`url(#mote-${size})`}
            stroke={theme.colors.brandTertiary}
            strokeWidth={Math.max(1, size * 0.025)}
            strokeOpacity={0.55}
          />
          <Ellipse
            cx={size * 0.32}
            cy={size * 0.62}
            rx={size * 0.06}
            ry={size * 0.035}
            fill={theme.colors.brandTertiary}
            fillOpacity={0.35}
          />
          <Ellipse
            cx={size * 0.68}
            cy={size * 0.62}
            rx={size * 0.06}
            ry={size * 0.035}
            fill={theme.colors.brandTertiary}
            fillOpacity={0.35}
          />
        </Svg>
      </Animated.View>

      <View style={[styles.eyes, { top: eyeTop, left: side, right: side }]}>
        {[0, 1].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.eye,
              {
                width: eyeWidth,
                height: eyeHeight,
                borderRadius: eyeWidth / 2,
                backgroundColor: '#FFFFFF',
                transform: [{ scaleY: eyeScale }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.pupil,
                {
                  width: pupilWidth,
                  height: pupilHeight,
                  borderRadius: pupilWidth / 2,
                  backgroundColor: '#24243A',
                  transform: [{ translateX: lookX }, { translateY: lookY }],
                },
              ]}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  eyes: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eye: { alignItems: 'center', justifyContent: 'center' },
  pupil: {},
});
