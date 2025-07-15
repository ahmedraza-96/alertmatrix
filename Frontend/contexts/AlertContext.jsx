import React, { createContext, useState, useEffect, useContext } from 'react';
import { Alert } from 'react-native';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { API_URL } from '../config/api';
import notificationService from '../utils/notificationService';

export const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
  const { isAuthenticated, token } = useContext(AuthContext);
  const [alerts, setAlerts] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [userCameraId, setUserCameraId] = useState(null);
  const [hasLiveAccess, setHasLiveAccess] = useState(false);

  // Fetch user camera access status
  const fetchUserCameraAccess = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/camera/access`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUserCameraId(data.cameraId);
        setHasLiveAccess(data.hasLiveAccess);
      }
    } catch (error) {
      console.error('Failed to fetch user camera access:', error);
    }
  };

  // Initialize notification service
  useEffect(() => {
    const initializeNotifications = async () => {
      const success = await notificationService.initialize();
      setNotificationsEnabled(success);
      
      if (success) {
        notificationService.setupNotificationListeners();
      }
    };

    initializeNotifications();

    // Cleanup on unmount
    return () => {
      notificationService.cleanup();
    };
  }, []);

  // Fetch user camera access when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserCameraAccess();
    } else {
      setUserCameraId(null);
      setHasLiveAccess(false);
      setAlerts([]);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = io(API_URL, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      console.log('🔌 Connected to alert socket');
    });

    socket.on('gun_alert', (payload) => {
      // Only show alerts if user has camera access and it's from their camera
      if (hasLiveAccess && userCameraId && payload.camera_id === userCameraId) {
        setAlerts((prev) => [payload, ...prev]);
        // Keep the original alert as fallback (no notifications)
        Alert.alert('Gun Detected!', `Camera: ${payload.camera_id}\nConfidence: ${Math.round(payload.confidence * 100)}%`);
      }
    });

    socket.on('knife_alert', (payload) => {
      // Only show alerts if user has camera access and it's from their camera
      if (hasLiveAccess && userCameraId && payload.camera_id === userCameraId) {
        setAlerts((prev) => [payload, ...prev]);
        // Keep the original alert as fallback (no notifications)
        Alert.alert('Knife Detected!', `Camera: ${payload.camera_id}\nConfidence: ${Math.round(payload.confidence * 100)}%`);
      }
    });

    // Listen for alarm events
    socket.on('alarm_event', (payload) => {
      console.log('🚨 Alarm event received:', payload);
      
      // Show push notification with vibration
      if (notificationsEnabled) {
        notificationService.showAlarmNotification(payload);
      }
      
      // Show in-app alert as fallback
      const status = payload.armed ? 'ARMED' : 'DISARMED';
      Alert.alert(
        `Alarm ${status}`, 
        `Alarm ID: ${payload.alarm_id}\nPartition: ${payload.partition}\nTime: ${payload.timestamp}`
      );
    });

    socket.on('disconnect', () => console.log('❌ Socket disconnected'));

    return () => socket.disconnect();
  }, [isAuthenticated, token, notificationsEnabled, hasLiveAccess, userCameraId]);

  return (
    <AlertContext.Provider value={{ 
      alerts, 
      notificationsEnabled,
      hasLiveAccess,
      userCameraId,
      refreshCameraAccess: fetchUserCameraAccess
    }}>
      {children}
    </AlertContext.Provider>
  );
}; 