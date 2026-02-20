'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { initPushNotifications, saveFcmToken } from '@/lib/push-notifications';

export default function PushNotificationInit() {
    const { user } = useAuth();

    // Register with FCM once on app load
    useEffect(() => {
        async function setup() {
            try {
                // Apply StatusBar fix at native level
                const { StatusBar, Style } = await import('@capacitor/status-bar');
                await StatusBar.setOverlaysWebView({ overlay: false });
                await StatusBar.setStyle({ style: Style.Dark });
                await StatusBar.setBackgroundColor({ color: '#0f172a' });
            } catch { /* browser, ignore */ }

            // Register with FCM (no Capacitor guard — tries silently, fails in browser)
            await initPushNotifications(user?.uid);
        }
        setup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run only once

    // When user signs in, save the FCM token that was already cached
    useEffect(() => {
        if (user?.uid) {
            saveFcmToken(user.uid);
        }
    }, [user?.uid]);

    return null;
}
