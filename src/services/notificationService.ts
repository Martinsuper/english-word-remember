import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestReminderPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') {
    return true;
  }
  const result = await Notifications.requestPermissionsAsync();
  return result.status === 'granted';
}

export async function cancelReminderNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleDailyReminder(hour: number, minute: number, reviewCount = 0, newCount = 0) {
  await cancelReminderNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '考研英语闪卡提醒',
      body: `今日还有 ${reviewCount} 个复习 + ${newCount} 个新词，完成一小批就能推进计划。`,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}
