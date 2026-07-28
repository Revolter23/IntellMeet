import React, { createContext, useContext, useState, useCallback } from 'react';

export interface NotificationItem {
	id: string;
	type: 'info' | 'success' | 'warning' | 'error' | 'user-joined' | 'user-left';
	title: string;
	message: string;
	timestamp: string;
	read?: boolean;
}

interface NotificationContextType {
	toasts: NotificationItem[];
	notifications: NotificationItem[];
	unreadCount: number;
	addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void;
	dismissToast: (id: string) => void;
	markAllAsRead: () => void;
	clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [toasts, setToasts] = useState<NotificationItem[]>([]);
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);

	const dismissToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const addNotification = useCallback(
		(data: Omit<NotificationItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => {
			const newItem: NotificationItem = {
				id: data.id || Date.now().toString() + Math.random().toString(36).substring(2, 6),
				type: data.type || 'info',
				title: data.title,
				message: data.message,
				timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
				read: false,
			};

			// Add to toast queue
			setToasts((prev) => [...prev, newItem]);

			// Add to persistent notification history
			setNotifications((prev) => [newItem, ...prev]);

			// Auto dismiss toast after 4.5 seconds
			setTimeout(() => {
				setToasts((prev) => prev.filter((t) => t.id !== newItem.id));
			}, 4500);
		},
		[]
	);

	const markAllAsRead = useCallback(() => {
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
	}, []);

	const clearNotifications = useCallback(() => {
		setNotifications([]);
	}, []);

	const unreadCount = notifications.filter((n) => !n.read).length;

	return (
		<NotificationContext.Provider
			value={{
				toasts,
				notifications,
				unreadCount,
				addNotification,
				dismissToast,
				markAllAsRead,
				clearNotifications,
			}}
		>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotification = () => {
	const context = useContext(NotificationContext);
	if (!context) {
		throw new Error('useNotification must be used within a NotificationProvider');
	}
	return context;
};
