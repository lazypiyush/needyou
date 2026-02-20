'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { initPushNotifications } from '@/lib/push-notifications';

export default function PushNotificationInit() {
    const { user } = useAuth();

    useEffect(() => {
        // Fix status bar overlap + init push notifications
        async function init() {
            try {
                const { Capacitor } = await import('@capacitor/core');
                if (!Capacitor.isNativePlatform()) return;

                // ✅ Fix status bar so content doesn't go behind it
                const { StatusBar, Style } = await import('@capacitor/status-bar');
                await StatusBar.setOverlaysWebView({ overlay: false });
                await StatusBar.setStyle({ style: Style.Dark });
                await StatusBar.setBackgroundColor({ color: '#0f172a' });

            } catch (e) {
                console.warn('[StatusBar] init failed:', e);
            }

            // Init push notifications
            await initPushNotifications(user?.uid);
        }

        init();
    }, [user?.uid]);

    return null;
}
