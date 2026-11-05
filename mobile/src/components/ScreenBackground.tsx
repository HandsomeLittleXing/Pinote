import React, { createContext, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme';
import { GrainOverlay } from './GrainOverlay';

type BlurTargetRef = React.RefObject<ComponentRef<typeof View> | null>;

export const BlurTargetContext = createContext<BlurTargetRef | null>(null);

/** 按皮肤绘制页面背景，同时作为 Android BlurView 的模糊目标 */
export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  const targetRef = useRef<ComponentRef<typeof View> | null>(null);

  return (
    <View style={styles.root}>
      <BlurTargetView
        ref={targetRef}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[theme.colors.backgroundStart, theme.colors.backgroundEnd]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {theme.skin !== 'glass' ? (
          <>
            <View style={[styles.blob, styles.blobA, { backgroundColor: theme.colors.blobA }]} />
            <View style={[styles.blob, styles.blobB, { backgroundColor: theme.colors.blobB }]} />
            {theme.colors.blobC ? (
              <View
                style={[
                  styles.blob,
                  styles.blobC,
                  { backgroundColor: theme.colors.blobC },
                ]}
              />
            ) : null}
          </>
        ) : null}
      </BlurTargetView>

      <GrainOverlay />

      <BlurTargetContext.Provider value={targetRef}>
        <View style={styles.content}>{children}</View>
      </BlurTargetContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobA: { width: 300, height: 300, top: -100, right: -80 },
  blobB: { width: 240, height: 240, bottom: 80, left: -100 },
  blobC: { width: 180, height: 180, top: '38%', left: '42%' },
});
