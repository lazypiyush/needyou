package com.needyou.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int NOTIFICATION_PERMISSION_CODE = 1001;
    private static final String APP_URL = "https://need-you.xyz/signin";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";
    private static final String CHANNEL_ID = "needyou_notifications";
    private static final String CHANNEL_NAME = "NeedYou Notifications";

    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean isShowingOfflinePage = false;
    private int notificationIdCounter = 1000;

    // ─── Native bridge exposed to the WebView ────────────────────────────────
    public class NeedYouBridge {

        /**
         * Called by offline.html Retry button: NeedYouBridge.retry()
         */
        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> {
                if (isNetworkAvailable()) {
                    loadApp();
                } else {
                    loadOffline(); // Reload to reset shake animation
                }
            });
        }

        /**
         * Called by the web app whenever a NEW unread notification arrives in
         * the Firestore `notifications` collection for the logged-in user.
         *
         * Usage in JS:
         * window.NeedYouBridge.showNotification("Title", "Body text here");
         *
         * This posts a real Android system notification so the user sees it even
         * if the app is in the foreground or background.
         */
        @JavascriptInterface
        public void showNotification(String title, String body) {
            postSystemNotification(title, body);
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Create the notification channel (required on Android 8+)
        createNotificationChannel();

        // 2. Request notification permission natively on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[] { Manifest.permission.POST_NOTIFICATIONS },
                        NOTIFICATION_PERMISSION_CODE);
            }
        }

        // 3. Expose NeedYouBridge to the WebView
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new NeedYouBridge(), "NeedYouBridge");

        // 4. Show offline page immediately if no internet on startup
        if (!isNetworkAvailable()) {
            loadOffline();
        }

        // 5. Listen for network changes throughout the session
        registerNetworkCallback();
    }

    // ─── System Notification ─────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Job and application alerts from NeedYou");
            channel.enableVibration(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void postSystemNotification(String title, String body) {
        // Tapping the notification re-opens the app
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info) // replace with your own icon later
                .setContentTitle(title != null ? title : "NeedYou")
                .setContentText(body != null ? body : "")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notificationIdCounter++, builder.build());
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null)
            return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network net = cm.getActiveNetwork();
            if (net == null)
                return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(net);
            return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } else {
            android.net.NetworkInfo info = cm.getActiveNetworkInfo();
            return info != null && info.isConnected();
        }
    }

    private void loadOffline() {
        isShowingOfflinePage = true;
        getBridge().getWebView().loadUrl(OFFLINE_URL);
    }

    private void loadApp() {
        isShowingOfflinePage = false;
        getBridge().getWebView().loadUrl(APP_URL);
    }

    private void registerNetworkCallback() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null)
            return;

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                if (isShowingOfflinePage) {
                    runOnUiThread(() -> loadApp());
                }
            }

            @Override
            public void onLost(Network network) {
                if (!isShowingOfflinePage) {
                    runOnUiThread(() -> loadOffline());
                }
            }
        };

        cm.registerNetworkCallback(
                new NetworkRequest.Builder()
                        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        .build(),
                networkCallback);
    }
}
