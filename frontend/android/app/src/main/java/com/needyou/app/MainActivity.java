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
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int NOTIFICATION_PERMISSION_CODE = 1001;
    private static final int LOCATION_PERMISSION_CODE = 1002;
    private static final String APP_URL = "https://need-you.xyz/dashboard";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";
    private static final String SPLASH_INTRO_URL = "file:///android_asset/splash_intro.html";
    private static final String CHANNEL_ID = "needyou_notifications";
    private static final String CHANNEL_NAME = "NeedYou Notifications";

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
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Show native splash.png while activity initialises
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

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

        // 3. Ask user about battery optimisation with an explanatory dialog
        showBatteryOptimizationDialog();

        // 4. Expose NeedYouBridge to the WebView
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new NeedYouBridge(), "NeedYouBridge");

        // 5. Enable Geolocation in WebView + show native permission dialog
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
        if (pm == null || pm.isIgnoringBatteryOptimizations(getPackageName()))
            return;

        new AlertDialog.Builder(this)
                .setTitle("Enable Background Notifications")
                .setMessage(
                        "To receive job alerts even when the app is closed, please allow NeedYou to run without battery restrictions.")
                .setPositiveButton("Allow", (dialog, which) -> requestBatteryOptimizationExemption())
                .setNegativeButton("Not Now", null)
                .setCancelable(true)
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
