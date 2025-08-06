import React, { useEffect, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showMessage } from 'react-native-flash-message';

import { RootState, AppDispatch } from '../store';
import { removeNotification } from '../store/slices/appSlice';

interface NotificationProviderProps {
  children: ReactNode;
}

const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { notifications } = useSelector((state: RootState) => state.app);

  useEffect(() => {
    // Show new notifications
    const unreadNotifications = notifications.filter(n => !n.read);
    
    if (unreadNotifications.length > 0) {
      const latestNotification = unreadNotifications[0];
      
      // Show flash message
      showMessage({
        message: latestNotification.title,
        description: latestNotification.message,
        type: getFlashMessageType(latestNotification.type),
        duration: getMessageDuration(latestNotification.type),
        autoHide: latestNotification.type !== 'error',
        onPress: () => {
          // Mark as read and remove from queue
          dispatch(removeNotification(latestNotification.id));
        },
      });

      // Auto-remove success and info messages after showing
      if (latestNotification.type === 'success' || latestNotification.type === 'info') {
        setTimeout(() => {
          dispatch(removeNotification(latestNotification.id));
        }, getMessageDuration(latestNotification.type));
      }
    }
  }, [notifications, dispatch]);

  return <>{children}</>;
};

const getFlashMessageType = (type: string): 'success' | 'danger' | 'warning' | 'info' => {
  switch (type) {
    case 'success':
      return 'success';
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'info';
  }
};

const getMessageDuration = (type: string): number => {
  switch (type) {
    case 'success':
      return 2000; // 2 seconds
    case 'error':
      return 0; // Manual dismiss
    case 'warning':
      return 4000; // 4 seconds
    case 'info':
    default:
      return 3000; // 3 seconds
  }
};

export default NotificationProvider;