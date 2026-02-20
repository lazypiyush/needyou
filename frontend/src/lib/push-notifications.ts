/**
 * push-notifications.ts
 * Handles FCM push notifications via Capacitor.
 * Safe to import anywhere - no-ops in browser.
 */

export async function initPushNotifications(userId?: string): Promise<void> {
    try {
        // With server.url, Capacitor bridge is injected natively.
        // We check for window.Capacitor as a more reliable signal.
        const cap = (window as any).Capacitor;
        if (!cap || !cap.isNativePlatform()) return;

        const { PushNotifications } = await import('@capacitor/push-notifications');

        // 1. Request permission
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') {
            console.warn('[FCM] Permission denied');
            return;
        }

        // 2. Register with FCM
        await PushNotifications.register();

        // 3. Save FCM token to Firestore
        PushNotifications.addListener('registration', async (token) => {
            console.log('[FCM] Token:', token.value);
            if (userId) {
                try {
                    const { doc, setDoc, getFirestore } = await import('firebase/firestore');
                    const { getApp } = await import('firebase/app');
                    const db = getFirestore(getApp());
                    await setDoc(doc(db, 'users', userId), { fcmToken: token.value }, { merge: true });
                } catch (e) {
                    console.error('[FCM] Failed to save token:', e);
                }
            }
        });

        PushNotifications.addListener('registrationError', (err) => {
            console.error('[FCM] Registration error:', err);
        });

        // 4. Handle notification taps (opens app + navigates)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const data = action.notification.data;
            if (data?.jobId) {
                window.location.href = `/dashboard?tab=jobs&highlight=${data.jobId}`;
            } else if (data?.url) {
                window.location.href = data.url;
            }
        });

    } catch (error) {
        console.error('[FCM] Init failed:', error);
    }
}
