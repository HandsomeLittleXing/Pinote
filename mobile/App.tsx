import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';
import PairingScreen from './src/screens/PairingScreen';
import StickerListScreen from './src/screens/StickerListScreen';
import StickerEditorScreen from './src/screens/StickerEditorScreen';
import { isPaired } from './src/api/syncClient';
import { useAppTheme } from './src/theme';
import { ScreenBackground } from './src/components/ScreenBackground';
import { ToastProvider } from './src/components/GlassToast';

export type RootStackParamList = {
  Pairing: undefined;
  List: undefined;
  Editor: { stickerId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const theme = useAppTheme();
  const [paired, setPaired] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setPaired(await isPaired());
      } catch {
        setPaired(false);
      }
    })();
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.backgroundStart).catch(() => {});
  }, [theme.colors.backgroundStart]);

  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navigationTheme: NavigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: 'transparent',
      card: 'transparent',
      text: theme.colors.text,
      border: 'transparent',
      notification: theme.colors.danger,
    },
  };

  if (paired === null) {
    return (
      <SafeAreaProvider>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <ScreenBackground>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>加载中...</Text>
          </View>
        </ScreenBackground>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ToastProvider>
        <NavigationContainer theme={navigationTheme}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'fade',
            }}
          >
            {paired ? (
              <>
                <Stack.Screen name="List">
                  {(props) => (
                    <StickerListScreen
                      onOpenSticker={(id) => props.navigation.navigate('Editor', { stickerId: id })}
                      onUnpaired={() => setPaired(false)}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="Editor">
                  {(props) => (
                    <StickerEditorScreen
                      stickerId={props.route.params.stickerId}
                      onBack={() => props.navigation.goBack()}
                    />
                  )}
                </Stack.Screen>
              </>
            ) : (
              <Stack.Screen name="Pairing">
                {() => <PairingScreen onPaired={() => setPaired(true)} />}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
