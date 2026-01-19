'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/notifications'
import { Notification } from '@/lib/auth'
import { Bell, CheckCircle, Check } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
    const { user } = useAuth()
    const { theme, systemTheme } = useTheme()
    const router = useRouter()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    // Real-time notifications listener
    useEffect(() => {
        if (!user?.uid) return

        setLoading(true)

        // Subscribe to real-time updates
        const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
            setNotifications(notifs)
            setLoading(false)
        })

        // Cleanup subscription on unmount
        return () => unsubscribe()
    }, [user?.uid])

    // Mark all unread notifications as read when page is viewed
    useEffect(() => {
        if (!user?.uid || notifications.length === 0) return

        const unreadNotifications = notifications.filter(n => !n.read)
        if (unreadNotifications.length > 0) {
            // Mark all as read immediately when page loads
            markAllNotificationsAsRead(user.uid)
        }
    }, [user?.uid, notifications.length]) // Only depend on length to avoid infinite loop

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            await markNotificationAsRead(notification.id)
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
            )
        }
        // TODO: Navigate to relevant page/modal based on notification type
    }

    const formatTimeAgo = (timestamp: number) => {
        const now = Date.now()
        const diff = now - timestamp
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        return `${days}d ago`
    }

    if (!mounted) return null

    const unreadCount = notifications.filter(n => !n.read).length

    const handleMarkAllRead = async () => {
        if (!user?.uid) return
        await markAllNotificationsAsRead(user.uid)
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: isDark ? '#0a0a0a' : '#f9fafb' }}>
            <div className="max-w-4xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Notifications
                        {unreadCount > 0 && (
                            <span className="ml-3 text-sm font-normal px-3 py-1 bg-blue-600 text-white rounded-full">
                                {unreadCount} new
                            </span>
                        )}
                    </h1>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                        >
                            <Check className="w-4 h-4" />
                            Mark all as read
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-12">
                        <Bell className="w-16 h-16 mx-auto mb-4" style={{ color: isDark ? '#4b5563' : '#d1d5db' }} />
                        <p className="text-lg" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                            Your notifications will appear here
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notifications.map(notification => (
                            <button
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className="w-full text-left p-4 rounded-xl border transition-all hover:shadow-md"
                                style={{
                                    backgroundColor: notification.read
                                        ? (isDark ? '#1a1a1a' : '#ffffff')
                                        : (isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(219, 234, 254, 0.5)'),
                                    borderColor: isDark ? '#2a2a2a' : '#e5e7eb'
                                }}
                            >
                                <div className="flex items-start gap-4">
                                    {!notification.read && (
                                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                {notification.title}
                                            </h3>
                                            <span className="text-sm" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                                {formatTimeAgo(notification.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-sm mb-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                            {notification.message}
                                        </p>
                                        {notification.amount && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-bold text-green-600 dark:text-green-400">
                                                    ₹{notification.amount.toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {notification.read && (
                                        <CheckCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
