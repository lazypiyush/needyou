/**
 * push-notifications.ts
 * Registers with FCM and saves the token to Firestore.
 * No Capacitor platform check — just tries and silently fails in browser.
 */

export async function initPushNotifications(userId?: string): Promise<void> {
    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Request permission (may already be granted natively by MainActivity.java)
        const result = await PushNotifications.requestPermissions();
        if (result.receive !== 'granted') return;

        // Register with FCM
        await PushNotifications.register();

        // Save FCM token to Firestore when received
        await PushNotifications.addListener('registration', async (token) => {
            console.log('[FCM] Token:', token.value);

            // Cache locally so we can save once user logs in
            try { localStorage.setItem('fcmToken', token.value); } catch (_) { }

            if (userId) {
                await saveFcmToken(userId, token.value);
            }
        });

        PushNotifications.addListener('registrationError', (err) => {
            console.warn('[FCM] Registration error:', err);
        });

        // Navigate on notification tap
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const data = action.notification.data;
            if (data?.jobId) {
                window.location.href = `/dashboard?tab=jobs&highlight=${data.jobId}`;
            } else if (data?.url) {
                window.location.href = data.url;
            }
        });

    } catch {
        // Not in Capacitor (browser) — silently ignored
    }
}

/** Save (or update) the FCM token on the user's Firestore document */
export async function saveFcmToken(userId: string, token?: string): Promise<void> {
    const fcmToken = token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('fcmToken') : null);
    if (!fcmToken || !userId) return;

    try {
        const { doc, setDoc, getFirestore } = await import('firebase/firestore');
        const { getApp } = await import('firebase/app');
        const db = getFirestore(getApp());
        await setDoc(doc(db, 'users', userId), { fcmToken }, { merge: true });
        console.log('[FCM] Token saved for user', userId);
    } catch (e) {
        console.error('[FCM] Failed to save token:', e);
    }
}
