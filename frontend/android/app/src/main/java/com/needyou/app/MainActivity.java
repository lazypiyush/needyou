package com.needyou.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;
import android.widget.Toast;
import android.util.Log;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final int NOTIFICATION_PERMISSION_CODE = 1001;
    private static final int LOCATION_PERMISSION_CODE = 1002;
    private static final String APP_URL = "https://need-you.xyz/dashboard";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";
    private static final String SPLASH_INTRO_URL = "file:///android_asset/splash_intro.html";
    private static final String CHANNEL_ID = "needyou_notifications";
    private static final String CHANNEL_NAME = "NeedYou Notifications";
    private static final String PREFS_NAME = "NeedYouPrefs";

    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean isShowingOfflinePage = false;
    private volatile boolean splashReady = false;
    private int notificationIdCounter = 1000;
    private long lastBackPressed = 0;
    private ValueCallback<Uri[]> fileUploadCallback = null;
    private ValueCallback<Uri[]> pendingFileCallback = null; // held while requesting media permission
    private static final int FILE_CHOOSER_REQUEST_CODE = 2000;
    private static final int MEDIA_PERMISSION_CODE = 3000;

    // ─── Native bridge exposed to the WebView ────────────────────────────────
    public class NeedYouBridge {

        /** Retry button in offline.html: NeedYouBridge.retry() */
        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> {
                if (isNetworkAvailable())
                    loadApp();
                else
                    loadOffline();
            });
        }

        /**
         * Called by splash_intro.html after its animation completes.
         * Navigates to the live app (if online) or the offline error page.
         */
        @JavascriptInterface
        public void splashDone() {
            runOnUiThread(() -> {
                if (isNetworkAvailable())
                    loadApp();
                else
                    loadOffline();
                splashReady = true; // release native splash screen
                registerNetworkCallback();
            });
        }

        /**
         * Called by JS whenever a NEW unread notification arrives in Firestore.
         * Posts a real Android system notification banner.
         */
        @JavascriptInterface
        public void showNotification(String title, String body) {
            postSystemNotification(title, body);
        }

        /**
         * Requests native location permission if not already granted.
         * Call from JS: window.NeedYouBridge.requestLocationPermission()
         */
        @JavascriptInterface
        public void requestLocationPermission() {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this,
                        Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[] {
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                            },
                            LOCATION_PERMISSION_CODE);
                }
            });
        }

        /**
         * Opens Android Location Settings so the user can enable GPS.
         * Call from JS: window.NeedYouBridge.openLocationSettings()
         */
        @JavascriptInterface
        public void openLocationSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                startActivity(intent);
            });
        }

        /**
         * Opens the battery optimisation settings for this app.
         * Call from JS: window.NeedYouBridge.openBatterySettings()
         */
        @JavascriptInterface
        public void openBatterySettings() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent intent = new Intent(
                            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                }
            });
        }

        /**
         * Returns true if battery optimisation is still active for this app.
         * Call from JS: window.NeedYouBridge.isBatteryOptimizationEnabled()
         */
        @JavascriptInterface
        public boolean isBatteryOptimizationEnabled() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                return pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName());
            }
            return false;
        }

        /**
         * Returns the FCM token cached in SharedPreferences (set by FirebaseMessaging
         * getToken() or onNewToken). JS calls this to push the token to Firestore
         * even before the Capacitor PushNotifications plugin fires its callback.
         * Call from JS: window.NeedYouBridge.getFcmToken()
         */
        @JavascriptInterface
        public String getFcmToken() {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            return prefs.getString("fcmToken", "");
        }
    }

    /**
     * Returns true for OEM ROMs (Vivo, Xiaomi, Redmi, Oppo, Realme, Samsung)
     * that intercept or drop touch events when the navigation bar is hidden
     * by the app — causing back/home/gesture navigation to stop working.
     * On stock-like devices (Google, Motorola, Nokia, Sony) hiding the nav bar
     * works correctly, so we allow full immersive there.
     */
    private boolean isAggressiveOemRom() {
        String m = Build.MANUFACTURER.toLowerCase();
        return m.contains("vivo")
                || m.contains("xiaomi")
                || m.contains("redmi")
                || m.contains("oppo")
                || m.contains("realme")
                || m.contains("samsung")
                || m.contains("tecno")
                || m.contains("infinix")
                || m.contains("itel");
    }

    private void hideSystemUI() {
        Window window = getWindow();
        // Allow content to draw behind system bars (edge-to-edge).
        WindowCompat.setDecorFitsSystemWindows(window, false);

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller == null)
            return;

        if (isAggressiveOemRom()) {
            // On aggressive OEM ROMs (Vivo, Xiaomi, Oppo, Realme, Samsung, etc.)
            // hiding the navigation bar causes the back/home buttons and gesture
            // navigation to stop responding. Only hide the status bar here so
            // that navigation stays fully functional on those devices.
            controller.hide(WindowInsetsCompat.Type.statusBars());
        } else {
            // On stock-like devices (Motorola, Google Pixel, Nokia, Sony, OnePlus)
            // full immersive mode works correctly — hide both bars.
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }

        // Swipe from edge to reveal bars transiently on all devices.
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-show battery dialog on every resume until exemption is granted.
        // This ensures users on Xiaomi, Realme, Vivo etc. who dismissed the
        // first-launch dialog are reminded again until they actually allow it.
        showBatteryOptimizationDialog();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus)
            hideSystemUI();
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Show native splash.png while activity initialises
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        hideSystemUI();

        // 1. Notification channel (Android 8+)
        createNotificationChannel();

        // 2. Request notification permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[] { Manifest.permission.POST_NOTIFICATIONS },
                        NOTIFICATION_PERMISSION_CODE);
            }
        }

        // 3. Battery optimisation dialog is shown in onResume so it re-appears
        // on every launch until the user actually grants the exemption.

        // 4. Expose NeedYouBridge to the WebView
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new NeedYouBridge(), "NeedYouBridge");

        // 5. Eagerly fetch the current FCM token and cache it in SharedPreferences.
        // This guarantees the token exists even before onNewToken() fires (e.g. on
        // reinstall). The JS push-notifications.ts reads it via
        // NeedYouBridge.getFcmToken().
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            if (token != null && !token.isEmpty()) {
                Log.d("NeedYouFCM", "FCM token fetched natively: " + token);
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                        .edit().putString("fcmToken", token).apply();
            }
        });

        webView.getSettings().setGeolocationEnabled(true);
        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin, GeolocationPermissions.Callback callback) {
                boolean granted = ContextCompat.checkSelfPermission(
                        MainActivity.this,
                        Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (granted) {
                    callback.invoke(origin, true, false);
                } else {
                    ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[] {
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                            },
                            LOCATION_PERMISSION_CODE);
                    callback.invoke(origin, false, false);
                }
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                // Cancel any pending callback
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                // Check media permission before launching picker
                boolean hasPermission;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    hasPermission = ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
                } else {
                    hasPermission = ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
                }

                if (!hasPermission) {
                    // Store the callback and request permission
                    pendingFileCallback = filePathCallback;
                    fileUploadCallback = null; // will be set after permission grant
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[] {
                                        Manifest.permission.READ_MEDIA_IMAGES,
                                        Manifest.permission.READ_MEDIA_VIDEO,
                                        Manifest.permission.CAMERA },
                                MEDIA_PERMISSION_CODE);
                    } else {
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[] {
                                        Manifest.permission.READ_EXTERNAL_STORAGE,
                                        Manifest.permission.CAMERA },
                                MEDIA_PERMISSION_CODE);
                    }
                    return true;
                }

                launchFilePicker(filePathCallback);
                return true;
            }
        });

        // 6. Load bundled splash intro — works offline, runs 2.7 s animation,
        // then calls NeedYouBridge.splashDone() to go to app or offline page
        getBridge().getWebView().loadUrl(SPLASH_INTRO_URL);
    }

    // ─── File chooser result ─────────────────────────────────────────────────

    /** Launches the system file/media picker for WebView file inputs. */
    private void launchFilePicker(ValueCallback<Uri[]> callback) {
        fileUploadCallback = callback;
        Intent galleryIntent = new Intent(Intent.ACTION_GET_CONTENT);
        galleryIntent.setType("*/*");
        galleryIntent.addCategory(Intent.CATEGORY_OPENABLE);
        galleryIntent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "image/*", "video/*", "audio/*" });
        galleryIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        Intent chooser = Intent.createChooser(galleryIntent, "Select Media");
        try {
            startActivityForResult(chooser, FILE_CHOOSER_REQUEST_CODE);
        } catch (ActivityNotFoundException e) {
            fileUploadCallback = null;
            callback.onReceiveValue(null);
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                ClipData clipData = data.getClipData();
                if (clipData != null && clipData.getItemCount() > 0) {
                    // Multiple files selected — iterate ClipData directly
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    // Single file
                    results = new Uri[] { data.getData() };
                } else {
                    // Final fallback
                    results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                }
            }
            if (fileUploadCallback != null) {
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MEDIA_PERMISSION_CODE && pendingFileCallback != null) {
            // Launch picker regardless of result — user can still pick from Recent files
            ValueCallback<Uri[]> cb = pendingFileCallback;
            pendingFileCallback = null;
            launchFilePicker(cb);
        }
    }

    // ─── Back button: navigate WebView history, double-back to exit ───────────

    @Override
    public void onBackPressed() {
        WebView webView = getBridge().getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            long now = System.currentTimeMillis();
            if (now - lastBackPressed < 2000) {
                super.onBackPressed(); // exit
            } else {
                lastBackPressed = now;
                Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
            }
        }
    }

    // ─── Battery optimisation ─────────────────────────────────────────────────

    private void showBatteryOptimizationDialog() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M)
            return;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        // If already exempted, nothing to do
        if (pm == null || pm.isIgnoringBatteryOptimizations(getPackageName()))
            return;

        // Detect common OEM ROMs that need extra manual steps
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        boolean isAggressiveOEM = manufacturer.contains("xiaomi")
                || manufacturer.contains("redmi")
                || manufacturer.contains("oppo")
                || manufacturer.contains("realme")
                || manufacturer.contains("vivo")
                || manufacturer.contains("oneplus");

        String message = "NeedYou needs to run in the background to deliver job alerts when the app is closed.\n\n"
                + "Tap \"Allow\" to disable battery optimisation for NeedYou.";

        if (isAggressiveOEM) {
            message += "\n\n\u26a0\ufe0f " + Build.MANUFACTURER
                    + " devices also require:\n"
                    + "Settings \u2192 Apps \u2192 NeedYou \u2192 Battery \u2192 No restrictions";
        }

        final String finalMessage = message;
        new AlertDialog.Builder(this)
                .setTitle("\uD83D\uDD14 Enable Background Notifications")
                .setMessage(finalMessage)
                .setPositiveButton("Allow", (dialog, which) -> requestBatteryOptimizationExemption())
                .setNegativeButton("Not Now", null)
                .setCancelable(false) // force a deliberate choice
                .show();
    }

    private void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Intent intent = new Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        }
    }

    // ─── System Notification ─────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Job and application alerts from NeedYou");
            channel.enableVibration(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null)
                nm.createNotificationChannel(channel);
        }
    }

    private void postSystemNotification(String title, String body) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setColor(0xFF1E5EFF)
                .setContentTitle(title != null ? title : "NeedYou")
                .setContentText(body != null ? body : "")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null)
            nm.notify(notificationIdCounter++, builder.build());
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
                if (isShowingOfflinePage)
                    runOnUiThread(() -> loadApp());
            }

            @Override
            public void onLost(Network network) {
                if (!isShowingOfflinePage)
                    runOnUiThread(() -> loadOffline());
            }
        };

        cm.registerNetworkCallback(
                new NetworkRequest.Builder()
                        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        .build(),
                networkCallback);
    }
}
