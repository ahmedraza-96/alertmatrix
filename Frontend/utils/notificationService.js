import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications are handled when the app is running
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  // Initialize notification service
  async initialize() {
    try {
      // Check if we're running in Expo Go and suppress the warning
      if (Constants.appOwnership === 'expo') {
        console.log('📱 Running in Expo Go - using local notifications only');
        return await this.initializeLocalNotifications();
      }

      // Check if device supports notifications
      if (!Device.isDevice) {
        console.warn('📱 Push notifications only work on physical devices');
        return await this.initializeLocalNotifications();
      }

      return await this.initializeLocalNotifications();
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
      return false;
    }
  }

  // Initialize local notifications only (works in Expo Go)
  async initializeLocalNotifications() {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('🚫 Notification permissions not granted');
        return false;
      }

      console.log('✅ Local notification permissions granted');

      // Set up notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('alerts', {
          name: 'Security Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      return true;
    } catch (error) {
      console.error('❌ Error initializing local notifications:', error);
      return false;
    }
  }

  // Show local notification for alarm event
  async showAlarmNotification(alarmData) {
    try {
      const { alarm_id, partition, armed, timestamp } = alarmData;
      
      // Trigger haptic feedback (vibration)
      await this.triggerVibration(armed ? 'armed' : 'disarmed');

      // Create notification content
      const title = armed ? '🚨 Alarm Armed!' : '✅ Alarm Disarmed';
      const body = `Alarm: ${alarm_id}\nPartition: ${partition}\nTime: ${timestamp}`;
      
      // Schedule notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: alarmData,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          sound: 'default',
          vibrate: armed ? [0, 250, 250, 250] : [0, 150, 150],
        },
        trigger: null, // Show immediately
      });

      console.log('📢 Alarm notification sent:', title);
    } catch (error) {
      console.error('❌ Error showing alarm notification:', error);
    }
  }

  // Trigger device vibration based on alarm state
  async triggerVibration(alarmState) {
    try {
      if (alarmState === 'armed') {
        // Strong vibration pattern for alarm armed
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        // Additional vibration pattern
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, 200);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, 400);
      } else if (alarmState === 'disarmed') {
        // Gentle vibration pattern for alarm disarmed
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 100);
      }
    } catch (error) {
      console.error('❌ Error triggering vibration:', error);
    }
  }

  // Set up notification listeners
  setupNotificationListeners() {
    // Listen for notifications received while app is running
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received:', notification);
    });

    // Listen for user interaction with notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      // Handle notification tap - could navigate to alerts screen
    });
  }

  // Clean up listeners
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  // (testNotification helper removed)
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService; 