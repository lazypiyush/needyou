'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { initPushNotifications, saveFcmToken } from '@/lib/push-notifications';
import { subscribeToNotifications } from '@/lib/notifications';

export default function PushNotificationInit() {
    const { user } = useAuth();
    const fcmInitialized = useRef(false);
    // Track notification IDs we've already shown to avoid re-notifying on page reload
    const seenIds = useRef<Set<string>>(new Set());
    // Only show notifications that arrive AFTER mount
    const mountTime = useRef<number>(Date.now());

    // ── FCM Registration ────────────────────────────────────────────────────
    // Run once on mount (for StatusBar) then again when user is known (for token saving)
    useEffect(() => {
        async function setup() {
            try {
                const { StatusBar, Style } = await import('@capacitor/status-bar');
                await StatusBar.setOverlaysWebView({ overlay: false });
                await StatusBar.setStyle({ style: Style.Dark });
                await StatusBar.setBackgroundColor({ color: '#0f172a' });
            } catch { /* browser, ignore */ }
        }
        setup();
    }, []);

    // Register FCM once we know the userId (avoids the timing bug where user is null on mount)
    useEffect(() => {
        if (!user?.uid || fcmInitialized.current) return;
        fcmInitialized.current = true;
        initPushNotifications(user.uid);
        saveFcmToken(user.uid); // Save any token already cached in localStorage
    }, [user?.uid]);

    // ── Native Notification Bridge ──────────────────────────────────────────
    // Subscribe to Firestore notifications; for each NEW unread one, call the
    // native Android bridge to post a real system notification banner.
    // (Works because WebView already knows the user via Firebase Auth)
    useEffect(() => {
        if (!user?.uid) return;

        const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
            notifications.forEach((notif) => {
                if (seenIds.current.has(notif.id)) return;
                seenIds.current.add(notif.id);

                // Ignore old notifications that existed before this session
                if (notif.createdAt <= mountTime.current) return;

                // Only native-notify for unread notifications
                if (notif.read) return;

                try {
                    const bridge = (window as any).NeedYouBridge;
                    if (bridge && typeof bridge.showNotification === 'function') {
                        bridge.showNotification(notif.title ?? 'NeedYou', notif.message ?? '');
                    }
                } catch (_) { /* not in native context */ }
            });
        });

        return () => unsubscribe();
    }, [user?.uid]);

    return null;
}
