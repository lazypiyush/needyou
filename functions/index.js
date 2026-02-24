/**
 * Firebase Cloud Function: sendFCMOnNotification
 *
 * Triggers whenever a new document is created in the `notifications` collection.
 * Looks up the recipient user's FCM token and sends them a push notification.
 *
 * Deploy with:
 *   cd functions
 *   npm install
 *   firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

exports.sendFCMOnNotification = functions.firestore
    .document('notifications/{notifId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        if (!notification) return;

        const { userId, title, message } = notification;
        if (!userId || !title) return;

        try {
            // Get the user's FCM token from Firestore
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

            // Send FCM push notification
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
                        icon: 'ic_launcher',          // uses @mipmap/ic_launcher (app icon)
                        color: '#1E5EFF',              // NeedYou brand blue
                        notificationPriority: 'PRIORITY_HIGH',
                        defaultVibrateTimings: true,
                        // No clickAction — lets Capacitor handle the tap natively
                    },
                },
                data: {
                    userId: userId,
                    notifId: context.params.notifId,
                    ...(notification.jobId ? { jobId: notification.jobId } : {}),
                },
            };

            await admin.messaging().send(fcmMessage);
            console.log(`[FCM] ✅ Notification sent to ${userId}`);

        } catch (error) {
            console.error('[FCM] ❌ Error sending notification:', error);
        }
    });
