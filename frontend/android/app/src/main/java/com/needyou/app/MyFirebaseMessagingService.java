package com.needyou.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * MyFirebaseMessagingService
 *
 * Handles FCM messages when the app is in the BACKGROUND or KILLED state.
 * When the app is in the foreground, Capacitor's PushNotifications plugin
 * fires the JS 'pushNotificationReceived' listener, which calls
 * NeedYouBridge.showNotification() instead.
 *
 * This service is also responsible for persisting updated FCM tokens to
 * SharedPreferences so the app can re-upload them to Firestore on next launch.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "NeedYouFCM";
    private static final String CHANNEL_ID = "needyou_notifications";
    private static final String CHANNEL_NAME = "NeedYou Notifications";
    private static final String PREFS_NAME = "NeedYouPrefs";
    private static final String KEY_FCM_TOKEN = "fcmToken";

    // Thread-safe notification ID counter shared within the service process
    private static final AtomicInteger notifIdCounter = new AtomicInteger(2000);

    // ─── Token refresh ────────────────────────────────────────────────────────

    /**
     * Called when a new FCM token is generated (first install or token rotation).
     * Persist it in SharedPreferences; MainActivity/WebView will pick it up on
     * next launch and save it to Firestore.
     */
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "FCM token refreshed: " + token);
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_FCM_TOKEN, token).apply();
    }

    // ─── Message received ─────────────────────────────────────────────────────

    /**
     * Called when a FCM message arrives while the app is in background or killed.
     *
     * FCM delivers two kinds of payloads:
     * 1. "notification" payload → Android auto-posts it using the meta-data
     * icon/channel declared in AndroidManifest. We still handle it here so
     * we can add deep-link data to the PendingIntent.
     * 2. "data" payload only → Android does NOT auto-post anything.
     * We MUST post the notification ourselves — this is the main gap this
     * service fills.
     *
     * Both cases are handled below.
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Log.d(TAG, "FCM message from: " + remoteMessage.getFrom());

        // Extract title / body from notification payload (if present)
        String title = "NeedYou";
        String body = "";
        if (remoteMessage.getNotification() != null) {
            RemoteMessage.Notification n = remoteMessage.getNotification();
            if (n.getTitle() != null)
                title = n.getTitle();
            if (n.getBody() != null)
                body = n.getBody();
        }

        // Fall back to data payload for title/body (data-only messages)
        Map<String, String> data = remoteMessage.getData();
        if (data.containsKey("title") && !data.get("title").isEmpty()) {
            title = data.get("title");
        }
        if (data.containsKey("body") && !data.get("body").isEmpty()) {
            body = data.get("body");
        }

        // Extract deep-link jobId if present
        String jobId = data.containsKey("jobId") ? data.get("jobId") : null;

        Log.d(TAG, "Posting notification — title: " + title + " | body: " + body);
        postNotification(title, body, jobId);
    }

    // ─── Post system notification ─────────────────────────────────────────────

    private void postNotification(String title, String body, String jobId) {
        ensureChannelExists();

        // Build an intent that re-opens MainActivity and passes deep-link extras
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (jobId != null && !jobId.isEmpty()) {
            intent.putExtra("jobId", jobId);
        }

        int piFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, notifIdCounter.get(), intent, piFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setColor(0xFF1E5EFF)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notifIdCounter.getAndIncrement(), builder.build());
        }
    }

    /**
     * Creates the notification channel on Android 8+ (safe to call multiple times).
     */
    private void ensureChannelExists() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Job and application alerts from NeedYou");
                channel.enableVibration(true);
                nm.createNotificationChannel(channel);
            }
        }
    }
}
