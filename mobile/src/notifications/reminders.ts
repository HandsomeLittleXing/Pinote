import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Sticker } from '@shared/types';
import { extractTitle } from '@shared/note';
import { getActiveStickers } from '../storage/db';

const CHANNEL_ID = 'sticker-reminders';
let reconciliation: Promise<void> = Promise.resolve();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '便签提醒',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function pendingReminder(sticker: Sticker): boolean {
  return !sticker.deletedAt && !sticker.reminderTriggered &&
    !!sticker.reminder && Date.parse(sticker.reminder) > Date.now();
}

async function reconcile(): Promise<void> {
  await ensureChannel();
  const permission = await Notifications.getPermissionsAsync();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter((item) => typeof item.content.data?.stickerId === 'string');
  const stickers = await getActiveStickers();
  const wanted = new Map(stickers.filter(pendingReminder).map((sticker) => [sticker.id, sticker]));

  for (const item of ours) {
    const data = item.content.data;
    const sticker = wanted.get(data?.stickerId as string);
    if (permission.granted && sticker && data?.reminder === sticker.reminder &&
      data?.title === extractTitle(sticker.content)) {
      wanted.delete(sticker.id);
    } else {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }
  if (!permission.granted) return;
  for (const sticker of wanted.values()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '便签提醒',
        body: extractTitle(sticker.content),
        data: { stickerId: sticker.id, reminder: sticker.reminder, title: extractTitle(sticker.content) },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(sticker.reminder!),
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
}

export function reconcileReminders(): Promise<void> {
  reconciliation = reconciliation.catch(() => {}).then(reconcile);
  return reconciliation;
}
