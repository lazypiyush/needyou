'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { initPushNotifications } from '@/lib/push-notifications';

/**
 * PushNotificationInit
 * 
 * Drop this anywhere in your layout tree (client-side).
 * It waits for the user to be authenticated and then
 * registers the device for FCM push notifications.
 * 
 * Safe to include always — it does nothing when running
 * in a normal browser (non-Capacitor environment).
 */
export default function PushNotificationInit() {
    const { user } = useAuth();

    useEffect(() => {
        // Initialise FCM once user is available (or even without user for anonymous tokens)
        initPushNotifications(user?.uid);
    }, [user?.uid]);

    // Renders nothing — purely a side-effect component
    return null;
}
