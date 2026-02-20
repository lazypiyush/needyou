/**
 * push-notifications.ts
 *
 * This module handles FCM push notifications via the Capacitor plugin.
 * It ONLY activates when running inside the Android/iOS native app wrapper.
 * When running in a normal browser, all Capacitor API calls are ignored.
 */

import { Capacitor } from '@capacitor/core';

/**
 * Initialise push notifications for the native app.
 * Call this once from your root layout (client component).
 */
export async function initPushNotifications(userId?: string): Promise<void> {
    // Only run inside a native Capacitor app (not in browser)
    if (!Capacitor.isNativePlatform()) return;

    try {
        // Dynamic import — avoids SSR errors in Next.js
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // ---------- 1. Request Permission ----------
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') {
            console.warn('[FCM] Push notification permission denied.');
            return;
        }

        // ---------- 2. Register with FCM ----------
        await PushNotifications.register();

        // ---------- 3. Get the FCM Token ----------
        PushNotifications.addListener('registration', async (token) => {
            console.log('[FCM] Device token:', token.value);

            // Save token to Firestore so the backend can send targeted notifications
            if (userId) {
                try {
                    const { doc, setDoc, getFirestore } = await import('firebase/firestore');
                    const { getApp } = await import('firebase/app');
                    const db = getFirestore(getApp());
                    await setDoc(
                        doc(db, 'users', userId),
                        { fcmToken: token.value },
                        { merge: true }
                    );
                    console.log('[FCM] Token saved to Firestore for user:', userId);
                } catch (err) {
                    console.error('[FCM] Failed to save token to Firestore:', err);
                }
            }
        });

        // ---------- 4. Handle Registration Error ----------
        PushNotifications.addListener('registrationError', (error) => {
            console.error('[FCM] Registration error:', error);
        });

        // ---------- 5. Handle Notification Received (app is in foreground) ----------
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[FCM] Notification received (foreground):', notification);
            // The notification is shown automatically in the notification panel.
            // You can also show an in-app toast/banner here if desired.
        });

        // ---------- 6. Handle Notification Tapped ----------
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[FCM] Notification tapped:', action);
            const data = action.notification.data;

            // Navigate based on notification data
            if (data?.jobId) {
                // e.g., navigate to a specific job
                window.location.href = `/dashboard?tab=jobs&highlight=${data.jobId}`;
            } else if (data?.url) {
                window.location.href = data.url;
            }
        });

    } catch (error) {
        console.error('[FCM] Push notification init failed:', error);
    }
}
