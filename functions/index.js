/**
 * Firebase Cloud Functions
 *
 * 1. sendFCMOnNotification      — sends FCM push when a notification doc is created
 * 2. notifyNearbyUsersOnNewJob  — fires on new job, notifies users within 20 km
 *
 * Deploy: cd functions && firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

// ─── Helper: Haversine distance in km ───────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── 1. FCM sender — triggered by new notification docs ─────────────────────
exports.sendFCMOnNotification = functions.firestore
    .document('notifications/{notifId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        if (!notification) return;

        const { userId, title, message } = notification;
        if (!userId || !title) return;

        try {
            const userDoc = await admin.firestore().collection('users').doc(userId).get();
            if (!userDoc.exists) {
                console.log(`[FCM] User ${userId} not found`);
                return;
            }

            const fcmToken = userDoc.data()?.fcmToken;
            if (!fcmToken) {
                console.log(`[FCM] No FCM token for user ${userId}`);
                return;
            }

            const fcmMessage = {
                token: fcmToken,
                notification: {
                    title: title,
                    body: message || '',
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'needyou_notifications',
                        icon: 'ic_stat_notification',
                        color: '#1E5EFF',
                        notificationPriority: 'PRIORITY_MAX',
                        defaultVibrateTimings: true,
                    },
                },
                data: {
                    userId: userId,
                    notifId: context.params.notifId,
                    ...(notification.jobId ? { jobId: notification.jobId } : {}),
                    ...(notification.type ? { type: notification.type } : {}),
                },
            };

            await admin.messaging().send(fcmMessage);
            console.log(`[FCM] ✅ Notification sent to ${userId}`);

        } catch (error) {
            console.error('[FCM] ❌ Error sending notification:', error);
        }
    });

// ─── 2. Nearby job notifier — triggered when a new job doc is created ────────
const NEARBY_RADIUS_KM = 20;

exports.notifyNearbyUsersOnNewJob = functions.firestore
    .document('jobs/{jobId}')
    .onCreate(async (snap, context) => {
        const job = snap.data();
        if (!job) return;

        const { userId: posterId, location, caption, category } = job;
        const jobId = context.params.jobId;

        if (!location?.latitude || !location?.longitude) {
            console.log('[NearbyNotify] Job has no location, skipping');
            return;
        }

        const jobLat = location.latitude;
        const jobLon = location.longitude;
        const categoryLabel = (category && category !== 'Other') ? category : null;

        // Build friendly notification text
        const title = '📍 New Job Near You!';
        const shortCaption = caption.length > 80
            ? caption.substring(0, 80) + '…'
            : caption;
        const message = categoryLabel
            ? `A new ${categoryLabel} job is available near you: "${shortCaption}"`
            : `A new job is available near your location: "${shortCaption}"`;

        try {
            const usersSnapshot = await admin.firestore().collection('users').get();

            const db = admin.firestore();
            const batch = db.batch();
            let notifCount = 0;

            usersSnapshot.forEach(userDoc => {
                const userData = userDoc.data();
                const uid = userDoc.id;

                // Skip the poster themselves
                if (uid === posterId) return;

                // User must have a saved location
                const userLat = userData?.location?.latitude;
                const userLon = userData?.location?.longitude;
                if (userLat == null || userLon == null) return;

                // Distance check
                const dist = haversineKm(jobLat, jobLon, userLat, userLon);
                if (dist > NEARBY_RADIUS_KM) return;

                // Each notification doc triggers sendFCMOnNotification automatically
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    userId: uid,
                    type: 'new_job_nearby',
                    title,
                    message,
                    jobId,
                    jobTitle: caption,
                    category: categoryLabel || 'General',
                    distanceKm: Math.round(dist * 10) / 10,
                    createdAt: Date.now(),
                    read: false,
                });
                notifCount++;
            });

            await batch.commit();
            console.log(`[NearbyNotify] ✅ Notified ${notifCount} user(s) within ${NEARBY_RADIUS_KM}km for job ${jobId}`);

        } catch (error) {
            console.error('[NearbyNotify] ❌ Error notifying nearby users:', error);
        }
    });
