import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { API_BASE_URL } from '../lib/config';
import { api } from '../lib/api';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export interface NotificationItem {
	id: string;
	type: 'info' | 'success' | 'warning' | 'error' | 'user-joined' | 'user-left' | 'mention' | 'action_item' | 'task_assigned';
	title: string;
	message: string;
	link?: string;
	timestamp: string;
	read?: boolean;
}

interface NotificationContextType {
	toasts: NotificationItem[];
	notifications: NotificationItem[];
	unreadCount: number;
	addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string; link?: string }) => void;
	dismissToast: (id: string) => void;
	markAllAsRead: () => void;
	clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const { user } = useAuthStore();
	const [toasts, setToasts] = useState<NotificationItem[]>([]);
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);

	// Fetch persistent notifications on user authentication
	useEffect(() => {
		if (!user) {
			setNotifications([]);
			return;
		}

		const fetchUserNotifications = async () => {
			try {
				const res = await api.get('/api/notifications');
				const loaded: NotificationItem[] = (res.data || []).map((n: any) => ({
					id: n._id || n.id,
					type: n.type || 'info',
					title: n.title,
					message: n.message,
					link: n.link,
					read: n.read || false,
					timestamp: new Date(n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
				}));
				setNotifications(loaded);
			} catch (err) {
				console.error("Error loading user notifications:", err);
			}
		};

		fetchUserNotifications();

		// Initialize socket connection for real-time user notifications
		if (!socket) {
			socket = io(API_BASE_URL, { withCredentials: true });
		}

		socket.emit('join-user-room', user.id);

		socket.on('receive-user-notification', (data: any) => {
			const newItem: NotificationItem = {
				id: data.id || Date.now().toString(),
				type: data.type || 'info',
				title: data.title,
				message: data.message,
				link: data.link,
				timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
				read: false
			};

			setToasts((prev) => [...prev, newItem]);
			setNotifications((prev) => [newItem, ...prev.filter(n => n.id !== newItem.id)]);

			setTimeout(() => {
				setToasts((prev) => prev.filter((t) => t.id !== newItem.id));
			}, 4500);
		});

		return () => {
			if (socket) {
				socket.off('receive-user-notification');
			}
		};
	}, [user?.id]);

	const dismissToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const addNotification = useCallback(
		(data: Omit<NotificationItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string; link?: string }) => {
			const newItem: NotificationItem = {
				id: data.id || Date.now().toString() + Math.random().toString(36).substring(2, 6),
				type: data.type || 'info',
				title: data.title,
				message: data.message,
				link: data.link,
				timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
				read: false,
			};

			setToasts((prev) => [...prev, newItem]);
			setNotifications((prev) => [newItem, ...prev]);

			setTimeout(() => {
				setToasts((prev) => prev.filter((t) => t.id !== newItem.id));
			}, 4500);
		},
		[]
	);

	const markAllAsRead = useCallback(async () => {
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
		try {
			await api.put('/api/notifications/read-all');
		} catch (err) {
			console.error("Error marking all notifications read:", err);
		}
	}, []);

	const clearNotifications = useCallback(async () => {
		setNotifications([]);
		try {
			await api.delete('/api/notifications/clear');
		} catch (err) {
			console.error("Error clearing notifications:", err);
		}
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
