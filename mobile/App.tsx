import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
} from 'react-native';
import { Text } from './src/components/AppText';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';
import PairingScreen from './src/screens/PairingScreen';
import StickerListScreen from './src/screens/StickerListScreen';
import StickerEditorScreen from './src/screens/StickerEditorScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { isPaired, syncNow } from './src/api/syncClient';
import { ThemeProvider, useAppTheme } from './src/theme';
import { ScreenBackground } from './src/components/ScreenBackground';
import { ToastProvider } from './src/components/GlassToast';
import * as Notifications from 'expo-notifications';
import { reconcileReminders } from './src/notifications/reminders';
import { markReminderTriggered } from './src/storage/db';
import { APP_FONT_FAMILY } from './src/font';

export type RootStackParamList = {
  Pairing: undefined;
  List: undefined;
  Editor: { stickerId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const [fontLoaded, fontError] = useFonts({
    [APP_FONT_FAMILY]: require('../resources/fonts/LianshengLingguangti-2.2.11-Variable.ttf'),
  });

  if (!fontLoaded && !fontError) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

function ThemedApp() {
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

  useEffect(() => {
    void reconcileReminders().catch(console.error);
    const markTriggered = (stickerId: unknown) => {
      if (typeof stickerId !== 'string') return;
      void markReminderTriggered(stickerId).then((changed) => {
        if (changed && paired) void syncNow().catch(console.error);
      }).catch(console.error);
    };
    const openReminder = (response: Notifications.NotificationResponse) => {
      const stickerId = response.notification.request.content.data?.stickerId;
      markTriggered(stickerId);
      if (typeof stickerId === 'string' && navigationRef.isReady()) {
        navigationRef.navigate('Editor', { stickerId });
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openReminder);
    const received = Notifications.addNotificationReceivedListener((notification) => {
      markTriggered(notification.request.content.data?.stickerId);
    });
    return () => { subscription.remove(); received.remove(); };
  }, [paired]);

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
        <NavigationContainer ref={navigationRef} theme={navigationTheme}
          onReady={() => {
            void Notifications.getLastNotificationResponseAsync().then((response) => {
              const stickerId = response?.notification.request.content.data?.stickerId;
              if (typeof stickerId === 'string') {
                void markReminderTriggered(stickerId).then((changed) => changed && paired ? syncNow() : undefined).catch(console.error);
                navigationRef.navigate('Editor', { stickerId });
                void Notifications.clearLastNotificationResponseAsync().catch(console.error);
              }
            }).catch(console.error);
          }}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'fade',
            }}
          >
                <Stack.Screen name="List">
                  {(props) => (
                    <StickerListScreen
                      onOpenSticker={(id) => props.navigation.navigate('Editor', { stickerId: id })}
                      onOpenSettings={() => props.navigation.navigate('Settings')}
                      paired={paired}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="Editor">
                  {(props) => (
                    <StickerEditorScreen
                      stickerId={props.route.params.stickerId}
                      onBack={() => props.navigation.goBack()}
                      onOpenSettings={() => props.navigation.navigate('Settings')}
                      paired={paired}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="Settings">
                  {(props) => (
                    <SettingsScreen
                      onBack={() => props.navigation.goBack()}
                      onUnpaired={() => setPaired(false)}
                      onOpenPairing={() => props.navigation.navigate('Pairing')}
                      paired={paired}
                    />
                  )}
                </Stack.Screen>
            <Stack.Screen name="Pairing">
              {(props) => <PairingScreen onBack={() => props.navigation.goBack()} onPaired={() => {
                setPaired(true);
                props.navigation.goBack();
              }} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
