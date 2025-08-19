import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 通知类型枚举
export enum NotificationType {
  PARKING_EXPIRING = 'parking_expiring',
  PARKING_EXPIRED = 'parking_expired',
  RESERVATION_CONFIRMED = 'reservation_confirmed',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  LOW_BALANCE = 'low_balance',
  SYSTEM_MESSAGE = 'system_message',
}

// 通知设置接口
export interface NotificationSettings {
  enabled: boolean;
  parkingNotifications: boolean;
  paymentNotifications: boolean;
  systemNotifications: boolean;
}

// Context接口
interface NotificationContextType {
  expoPushToken: string | null;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  scheduleNotification: (
    title: string,
    body: string,
    type: NotificationType,
    data?: any,
    trigger?: Notifications.NotificationTriggerInput
  ) => Promise<string | null>;
  cancelNotification: (identifier: string) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  hasPermissions: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// 设置通知行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled: true,
    parkingNotifications: true,
    paymentNotifications: true,
    systemNotifications: true,
  });

  // 请求通知权限
  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('通知权限被拒绝');
        setHasPermissions(false);
        return false;
      }

      setHasPermissions(true);
      return true;
    } catch (error) {
      console.error('请求通知权限失败:', error);
      return false;
    }
  };

  // 获取Expo推送令牌
  const registerForPushNotificationsAsync = async (): Promise<string | null> => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'fe79928f-ca29-4e3f-a595-0360b7c24258', // 从app.json获取
      });

      console.log('Expo推送令牌:', tokenData.data);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return tokenData.data;
    } catch (error) {
      console.error('获取推送令牌失败:', error);
      return null;
    }
  };

  // 初始化
  useEffect(() => {
    const initializeNotifications = async () => {
      const token = await registerForPushNotificationsAsync();
      setExpoPushToken(token);
    };

    initializeNotifications();
  }, []);

  // 更新通知设置
  const updateNotificationSettings = async (settings: Partial<NotificationSettings>) => {
    const newSettings = { ...notificationSettings, ...settings };
    setNotificationSettings(newSettings);
    
    // 如果禁用了通知，取消所有待发通知
    if (!newSettings.enabled) {
      await cancelAllNotifications();
    }
  };

  // 安排通知
  const scheduleNotification = async (
    title: string,
    body: string,
    type: NotificationType,
    data?: any,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string | null> => {
    try {
      // 检查全局通知是否开启
      if (!notificationSettings.enabled) {
        return null;
      }

      // 检查特定类型的通知是否开启
      switch (type) {
        case NotificationType.PARKING_EXPIRING:
        case NotificationType.PARKING_EXPIRED:
          if (!notificationSettings.parkingNotifications) return null;
          break;
        case NotificationType.PAYMENT_SUCCESS:
        case NotificationType.PAYMENT_FAILED:
        case NotificationType.LOW_BALANCE:
          if (!notificationSettings.paymentNotifications) return null;
          break;
        case NotificationType.SYSTEM_MESSAGE:
          if (!notificationSettings.systemNotifications) return null;
          break;
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type, ...data },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: trigger || null, // 立即发送或按指定触发器
      });

      console.log('通知已安排:', identifier, { title, body, type });
      return identifier;
    } catch (error) {
      console.error('安排通知失败:', error);
      return null;
    }
  };

  // 取消单个通知
  const cancelNotification = async (identifier: string) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log('已取消通知:', identifier);
    } catch (error) {
      console.error('取消通知失败:', error);
    }
  };

  // 取消所有通知
  const cancelAllNotifications = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('已取消所有通知');
    } catch (error) {
      console.error('取消所有通知失败:', error);
    }
  };

  const value: NotificationContextType = {
    expoPushToken,
    notificationSettings,
    updateNotificationSettings,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    requestPermissions,
    hasPermissions,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// Hook来使用通知上下文
export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification必须在NotificationProvider内使用');
  }
  return context;
}

// 工具函数：格式化时间触发器
export const createTimeTrigger = (date: Date): Notifications.DateTriggerInput => {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
  };
};

// 工具函数：创建重复触发器
export const createIntervalTrigger = (seconds: number): Notifications.TimeIntervalTriggerInput => {
  return {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds,
    repeats: false,
  };
};