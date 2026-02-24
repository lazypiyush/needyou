/**
 * push-notifications.ts
 * Registers with FCM, saves token to Firestore, and handles foreground/background notifications.
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
        PushNotifications.addListener('registration', async (token) => {
            console.log('[FCM] Token received:', token.value);

            // Always cache locally
            try { localStorage.setItem('fcmToken', token.value); } catch (_) { }

            // Save to Firestore with whatever userId we have
            // (saveFcmToken will also be called again once user logs in)
            if (userId) {
                await saveFcmToken(userId, token.value);
            } else {
                // Try to get userId from localStorage fallback
                try {
                    const cachedUid = localStorage.getItem('cachedUserId');
                    if (cachedUid) await saveFcmToken(cachedUid, token.value);
                } catch (_) { }
            }
        });

        PushNotifications.addListener('registrationError', (err) => {
            console.warn('[FCM] Registration error:', err);
        });

        // ── Foreground notification handler ─────────────────────────────────
        // When app is in FOREGROUND, Android does NOT auto-show FCM banners.
        // We call the native bridge to post a real system notification.
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[FCM] Foreground notification received:', notification);
            const title = notification.title ?? 'NeedYou';
            const body = notification.body ?? '';
            try {
                const bridge = (window as any).NeedYouBridge;
                if (bridge && typeof bridge.showNotification === 'function') {
                    bridge.showNotification(title, body);
                }
            } catch (_) { /* no bridge in browser */ }
        });

        // Navigate on notification tap (background/killed state)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const data = action.notification.data;
            if (data?.jobId) {
                window.location.href = `/dashboard?tab=jobs&highlight=${data.jobId}`;
            } else if (data?.url) {
                window.location.href = data.url;
            } else {
                // Default: open dashboard alerts tab
                window.location.href = '/dashboard?tab=notifications';
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

    // Cache userId so registration callback can use it even if called before auth resolves
    try { localStorage.setItem('cachedUserId', userId); } catch (_) { }

    try {
        const { doc, setDoc, getFirestore } = await import('firebase/firestore');
        const { getApp } = await import('firebase/app');
        const db = getFirestore(getApp());
        await setDoc(doc(db, 'users', userId), { fcmToken }, { merge: true });
        console.log('[FCM] ✅ Token saved for user', userId);
    } catch (e) {
        console.error('[FCM] ❌ Failed to save token:', e);
    }
}
