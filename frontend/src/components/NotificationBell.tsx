'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, subscribeToNotifications } from '@/lib/notifications'
import { useAuth } from '@/context/AuthContext'
import { Notification } from '@/lib/auth'
import { useTheme } from 'next-themes'

interface NotificationBellProps {
    onNotificationClick?: (notification: Notification) => void
}

export default function NotificationBell({ onNotificationClick }: NotificationBellProps) {
    const { user } = useAuth()
    const { theme, systemTheme } = useTheme()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const unreadCount = notifications.filter(n => !n.read).length

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            await markNotificationAsRead(notification.id)
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
            )
        }

        // Close dropdown
        setShowDropdown(false)

        // Call parent handler
        if (onNotificationClick) {
            onNotificationClick(notification)
        }
    }

    const handleMarkAllRead = async () => {
        if (!user?.uid) return
        await markAllNotificationsAsRead(user.uid)
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
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

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-6 h-6" style={{ color: isDark ? '#ffffff' : '#000000' }} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {showDropdown && (
                <div
                    className="absolute right-0 mt-2 w-96 max-h-[500px] overflow-y-auto rounded-xl shadow-2xl z-50"
                    style={{
                        backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                        border: `1px solid ${isDark ? '#2a2a2a' : '#e5e7eb'}`
                    }}
                >
                    {/* Header */}
                    <div
                        className="p-4 border-b flex items-center justify-between sticky top-0 z-10"
                        style={{
                            backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                            borderColor: isDark ? '#2a2a2a' : '#e5e7eb'
                        }}
                    >
                        <h3 className="font-bold text-lg" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                            Notifications
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="divide-y" style={{ borderColor: isDark ? '#2a2a2a' : '#e5e7eb' }}>
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="w-12 h-12 mx-auto mb-2" style={{ color: isDark ? '#4b5563' : '#d1d5db' }} />
                                <p style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <button
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    style={{
                                        backgroundColor: notification.read
                                            ? 'transparent'
                                            : isDark
                                                ? 'rgba(59, 130, 246, 0.1)'
                                                : 'rgba(219, 234, 254, 0.5)'
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        {!notification.read && (
                                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm mb-1" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                {notification.title}
                                            </p>
                                            <p className="text-sm mb-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                {notification.message}
                                            </p>
                                            <p className="text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                                {formatTimeAgo(notification.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
