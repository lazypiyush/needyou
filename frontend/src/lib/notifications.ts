import { collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { Notification } from './auth'

// Helper function to ensure db is initialized
const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Firestore is not initialized. Please ensure you are running this in a browser environment.')
    }
    return db
}

// Create a notification
export const createNotification = async (
    notification: Omit<Notification, 'id'>
): Promise<void> => {
    try {
        const dbInstance = ensureDbInitialized()
        await addDoc(collection(dbInstance, 'notifications'), {
            ...notification,
            createdAt: Date.now(),
            read: false
        })
        console.log('✅ Notification created')
    } catch (error: any) {
        console.error('❌ Create Notification Error:', error)
        throw new Error(error.message || 'Failed to create notification')
    }
}

// Get user notifications
export const getUserNotifications = async (
    userId: string
): Promise<Notification[]> => {
    try {
        const dbInstance = ensureDbInitialized()
        const notificationsRef = collection(dbInstance, 'notifications')
        const q = query(
            notificationsRef,
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        )

        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Notification))
    } catch (error: any) {
        console.error('❌ Get Notifications Error:', error)
        return []
    }
}

// Real-time listener for user notifications
export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: Notification[]) => void
) => {
    try {
        const dbInstance = ensureDbInitialized()
        const notificationsRef = collection(dbInstance, 'notifications')
        const q = query(
            notificationsRef,
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        )

        // Set up real-time listener
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Notification))
            callback(notifications)
        })

        return unsubscribe
    } catch (error: any) {
        console.error('❌ Subscribe to Notifications Error:', error)
        return () => { } // Return empty unsubscribe function
    }
}

// Mark notification as read
export const markNotificationAsRead = async (
    notificationId: string
): Promise<void> => {
    try {
        const dbInstance = ensureDbInitialized()
        const notificationRef = doc(dbInstance, 'notifications', notificationId)
        await updateDoc(notificationRef, {
            read: true
        })
    } catch (error: any) {
        console.error('❌ Mark Notification Read Error:', error)
    }
}

// Mark all notifications as read
export const markAllNotificationsAsRead = async (
    userId: string
): Promise<void> => {
    try {
        const dbInstance = ensureDbInitialized()
        const notificationsRef = collection(dbInstance, 'notifications')
        const q = query(
            notificationsRef,
            where('userId', '==', userId),
            where('read', '==', false)
        )

        const snapshot = await getDocs(q)
        const updatePromises = snapshot.docs.map(doc =>
            updateDoc(doc.ref, { read: true })
        )

        await Promise.all(updatePromises)
        console.log('✅ All notifications marked as read')
    } catch (error: any) {
        console.error('❌ Mark All Read Error:', error)
    }
}
