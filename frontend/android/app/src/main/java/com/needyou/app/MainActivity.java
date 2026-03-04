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
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.app.Dialog;
import android.graphics.Color;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.widget.Toast;
import android.util.Log;
import android.provider.MediaStore;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

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
    private static final int CAMERA_PERMISSION_CODE = 4000; // for getUserMedia / liveness
    private static final int CAMERA_CAPTURE_REQUEST_CODE = 5000; // photo capture via ACTION_IMAGE_CAPTURE
    private static final int VIDEO_CAPTURE_REQUEST_CODE = 6000; // video capture via ACTION_VIDEO_CAPTURE
    private static final int MIC_PERMISSION_CODE = 7000; // microphone for chat voice recording

    // URI for the temp file created for ACTION_IMAGE_CAPTURE
    private Uri cameraImageUri = null;

    // Held while we ask the user for CAMERA runtime permission during getUserMedia
    private PermissionRequest pendingCameraPermissionRequest = null;

    // Prevents the battery-optimisation dialog from re-appearing on EVERY onResume
    // (e.g. when returning from the Settings screen it just opened).
    // Reset to false each time a fresh Activity instance is created.
    private boolean batteryDialogShown = false;

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

        /**
         * Returns a JSON string like {"type":"job_hired","jobId":"..."} if the app
         * was launched via a push-notification tap, or "" otherwise.
         * Call from JS on mount: window.NeedYouBridge.getPendingDeepLink()
         */
        @JavascriptInterface
        public String getPendingDeepLink() {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            return prefs.getString("pendingDeepLink", "");
        }

        /**
         * Clears the pending deep-link after the React app has consumed it.
         * Call from JS: window.NeedYouBridge.clearPendingDeepLink()
         */
        @JavascriptInterface
        public void clearPendingDeepLink() {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit().remove("pendingDeepLink").apply();
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

        // Hide BOTH status bar and navigation bar on all devices.
        // BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE means bars stay hidden
        // and only appear briefly when the user swipes from the edge —
        // this is the correct approach that works on OEM ROMs (Vivo, Samsung,
        // Xiaomi, Oppo, Realme) without breaking touch events on back/home.
        controller.hide(WindowInsetsCompat.Type.systemBars());
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

        // 2. Request notification permission (Android 13+) — ask only once ever.
        // We track whether the user has already responded using SharedPreferences.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            boolean alreadyAsked = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .getBoolean("notifPermissionAsked", false);
            if (!alreadyAsked &&
                    ContextCompat.checkSelfPermission(this,
                            Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                        .edit().putBoolean("notifPermissionAsked", true).apply();
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
        // Required for onCreateWindow to intercept window.open() calls.
        // Without these two flags every window.open() (e.g. DigiLocker popup)
        // bypasses onCreateWindow and opens in Chrome instead.
        webView.getSettings().setSupportMultipleWindows(true);
        webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
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

            // ── Camera / microphone for getUserMedia (liveness detection + chat voice) ──
            // Without this override the WebView silently denies any getUserMedia
            // call, even if CAMERA / RECORD_AUDIO are listed in AndroidManifest.xml.
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean hasCam = ContextCompat.checkSelfPermission(
                            MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                    boolean hasMic = ContextCompat.checkSelfPermission(
                            MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;

                    if (hasCam && hasMic) {
                        // Both permissions granted — allow all requested resources immediately
                        request.grant(request.getResources());
                    } else {
                        // Ask for whichever permissions are missing
                        pendingCameraPermissionRequest = request;
                        java.util.List<String> missing = new java.util.ArrayList<>();
                        if (!hasCam)
                            missing.add(Manifest.permission.CAMERA);
                        if (!hasMic)
                            missing.add(Manifest.permission.RECORD_AUDIO);
                        ActivityCompat.requestPermissions(
                                MainActivity.this,
                                missing.toArray(new String[0]),
                                CAMERA_PERMISSION_CODE);
                    }
                });
            }

            // ── DigiLocker / any window.open() popup ─────────────────────────
            // Open popups inside the app — NOT Chrome — so postMessage flows back.
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog,
                    boolean isUserGesture, android.os.Message resultMsg) {

                final Dialog popup = new Dialog(MainActivity.this,
                        android.R.style.Theme_Black_NoTitleBar_Fullscreen);

                // ── Root layout ───────────────────────────────────────────────
                LinearLayout root = new LinearLayout(MainActivity.this);
                root.setOrientation(LinearLayout.VERTICAL);
                root.setBackgroundColor(Color.WHITE);

                // ── Header bar (blue + title + close button) ──────────────────
                LinearLayout header = new LinearLayout(MainActivity.this);
                header.setOrientation(LinearLayout.HORIZONTAL);
                header.setBackgroundColor(0xFF1E5EFF);
                header.setPadding(16, 48, 16, 8);
                header.setGravity(android.view.Gravity.END);

                Button closeBtn = new Button(MainActivity.this);
                closeBtn.setText("\u2715");
                closeBtn.setTextColor(Color.WHITE);
                closeBtn.setTextSize(20);
                closeBtn.setBackgroundColor(Color.TRANSPARENT);
                closeBtn.setOnClickListener(v -> popup.dismiss());

                header.addView(closeBtn);

                // ── Popup WebView fills the rest ───────────────────────────────
                final WebView popupView = new WebView(MainActivity.this);
                popupView.getSettings().setJavaScriptEnabled(true);
                popupView.getSettings().setDomStorageEnabled(true);
                popupView.getSettings().setSupportMultipleWindows(true);
                popupView.getSettings().setAllowFileAccess(true);
                popupView.getSettings().setDatabaseEnabled(true);
                // Strip WebView 'wv' marker — some auth providers (e.g. Google) block embedded
                // WebViews
                String ua = popupView.getSettings().getUserAgentString();
                if (ua != null) {
                    popupView.getSettings().setUserAgentString(
                            ua.replace("; wv", "").replace(" wv", "").trim());
                }
                // Allow mixed HTTP/HTTPS resources (required for DigiLocker on older Android)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    popupView.getSettings().setMixedContentMode(
                            android.webkit.WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
                }

                // ── Layer 1: JavascriptInterface bridge (popup → main WebView) ─
                // Injected as 'NeedYouPopupBridge' into the popup's JS context.
                // Works on ALL OEMs — no URL pattern needed.
                popupView.addJavascriptInterface(new Object() {
                    @android.webkit.JavascriptInterface
                    public void onDone(String clientId, String url) {
                        runOnUiThread(() -> {
                            String safeId = clientId != null ? clientId.replace("'", "\\'") : "";
                            String safeUrl = url != null ? url.replace("'", "\\'").replace("\n", "") : "";
                            getBridge().getWebView().evaluateJavascript(
                                    "window.dispatchEvent(new CustomEvent('digilocker_done'," +
                                            "{ detail:{clientId:'" + safeId + "',url:'" + safeUrl + "'} }));",
                                    null);
                            popup.dismiss();
                        });
                    }

                    @android.webkit.JavascriptInterface
                    public void onMessage(String json) {
                        // DigiBoost SDK used window.opener.postMessage() — relay to main WebView
                        runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(
                                "window.dispatchEvent(new MessageEvent('message'," +
                                        "{ data:" + (json != null ? json : "{}") + ",origin:'*' }));",
                                null));
                    }
                }, "NeedYouPopupBridge");

                // ── Layer 2: JS polyfill — injected on every page in the popup ─
                // Patches window.opener (null in WebViewTransport) so postMessage
                // and window.close flow through our JavascriptInterface.
                // Applied in onPageFinished so it survives SPA page transitions.
                final String POPUP_POLYFILL = "(function(){"
                        + "if(window.__nyPatched)return;window.__nyPatched=true;"
                // Patch window.opener so DigiBoost SDK's postMessage reaches Java
                        + "window.opener={"
                        + "  postMessage:function(data,o){"
                        + "    try{"
                        + "      var cid=data&&(data.client_id||data.clientId||data.code||'');"
                        + "      NeedYouPopupBridge.onMessage(JSON.stringify(data));"
                        + "      if(cid)NeedYouPopupBridge.onDone(String(cid),location.href);"
                        + "    }catch(e){}"
                        + "  }"
                        + "};"
                // Patch window.close so APK detects when SDK closes the auth window
                        + "var _c=window.close;"
                        + "window.close=function(){"
                        + "  try{NeedYouPopupBridge.onDone('',location.href);}catch(e){}"
                        + "  try{_c.call(window);}catch(e){}"
                        + "};"
                        + "})();";

                // ── Layer 3: URL detection as a safety net ────────────────────
                popupView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView wv, String url) {
                        super.onPageFinished(wv, url);
                        // Re-inject polyfill on every page (survives redirects & SPAs)
                        wv.evaluateJavascript(POPUP_POLYFILL, null);

                        // Fallback URL-based detection for OEMs that sandbox addJavascriptInterface
                        if (url != null
                                && (url.contains("surepass") || url.contains("digilocker")
                                        || url.contains("digitallocker"))
                                && (url.contains("success") || url.contains("callback") || url.contains("complete"))) {
                            String clientId = "";
                            try {
                                android.net.Uri uri = android.net.Uri.parse(url);
                                String cid = uri.getQueryParameter("client_id");
                                if (cid == null)
                                    cid = uri.getQueryParameter("clientId");
                                if (cid == null)
                                    cid = uri.getQueryParameter("code");
                                if (cid != null)
                                    clientId = cid;
                            } catch (Exception ignored) {
                            }
                            final String fid = clientId;
                            runOnUiThread(() -> {
                                getBridge().getWebView().evaluateJavascript(
                                        "window.dispatchEvent(new CustomEvent('digilocker_done'," +
                                                "{ detail:{clientId:'" + fid.replace("'", "\\'") + "',url:'"
                                                + url.replace("'", "\\'").replace("\n", "") + "'} }));",
                                        null);
                                popup.dismiss();
                            });
                        }
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView wv,
                            android.webkit.WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        if (url.startsWith("http://") || url.startsWith("https://"))
                            return false; // all HTTP stays in popup
                        // System schemes (tel:, mailto:, intent://) → OS
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)));
                        } catch (ActivityNotFoundException ignored) {
                        }
                        return true;
                    }
                });

                popupView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        runOnUiThread(() -> {
                            getBridge().getWebView().evaluateJavascript(
                                    "window.dispatchEvent(new CustomEvent('digilocker_done'," +
                                            "{ detail:{clientId:'',closed:true} }));",
                                    null);
                            popup.dismiss();
                        });
                    }
                });
                LinearLayout.LayoutParams webParams = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f);
                popupView.setLayoutParams(webParams);

                root.addView(header);
                root.addView(popupView);
                popup.setContentView(root);
                popup.show();

                // ── Hide system nav bar in the popup window ───────────────────
                // The main window already runs in immersive mode via hideSystemUI().
                // The Dialog has its OWN Window, so we must apply the same flags
                // here — otherwise the 3-button nav bar (back/home/recents) creeps
                // back into view when DigiLocker opens on all OEM devices.
                if (popup.getWindow() != null) {
                    android.view.Window popupWindow = popup.getWindow();
                    WindowCompat.setDecorFitsSystemWindows(popupWindow, false);
                    WindowInsetsControllerCompat popupCtrl = WindowCompat.getInsetsController(popupWindow,
                            popupWindow.getDecorView());
                    if (popupCtrl != null) {
                        popupCtrl.hide(WindowInsetsCompat.Type.systemBars());
                        popupCtrl.setSystemBarsBehavior(
                                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    }
                    // Re-apply on every focus change so bars stay hidden after
                    // any OEM gesture / notification shade interaction.
                    popupWindow.getDecorView().setOnSystemUiVisibilityChangeListener(visibility -> {
                        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(popupWindow,
                                popupWindow.getDecorView());
                        if (c != null) {
                            c.hide(WindowInsetsCompat.Type.systemBars());
                            c.setSystemBarsBehavior(
                                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                        }
                    });
                }

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupView);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {

                // Cancel any pending callback first
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                // ── Detect capture mode ──────────────────────────────────────
                // isCaptureEnabled() == true when the <input> had a capture attribute.
                // Accept types tell us whether it's a photo (image/*) or video (video/*).
                boolean captureEnabled = fileChooserParams.isCaptureEnabled();
                String[] acceptTypes = fileChooserParams.getAcceptTypes();
                boolean wantsVideo = acceptTypes != null &&
                        Arrays.asList(acceptTypes).toString().contains("video");
                boolean wantsImage = !wantsVideo && captureEnabled;

                if (captureEnabled && !wantsVideo) {
                    // ── Camera Photo ─────────────────────────────────────────
                    boolean hasCam = ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                    if (!hasCam) {
                        pendingCameraPermissionRequest = null; // not a getUserMedia request
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[] { Manifest.permission.CAMERA }, CAMERA_PERMISSION_CODE);
                        // Will be handled in onRequestPermissionsResult → launchCameraForPhoto
                        return true;
                    }
                    launchCameraForPhoto();
                    return true;
                }

                if (captureEnabled && wantsVideo) {
                    // ── Camera Video ─────────────────────────────────────────
                    boolean hasCam = ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                    if (!hasCam) {
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[] { Manifest.permission.CAMERA }, CAMERA_PERMISSION_CODE);
                        return true;
                    }
                    launchCameraForVideo();
                    return true;
                }

                // ── Gallery / file picker (no capture attribute) ──────────────
                boolean hasPermission;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    hasPermission = ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED;
                } else {
                    hasPermission = ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
                }

                if (!hasPermission) {
                    pendingFileCallback = filePathCallback;
                    fileUploadCallback = null;
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

        // 7. Store any deep-link from the notification that launched this Activity
        handleDeepLinkIntent(getIntent());
    }

    /**
     * Parses jobId + notificationType from a notification-tap intent and persists
     * them in SharedPreferences so the React app can read them on mount via
     * NeedYouBridge.getPendingDeepLink().
     */
    private void handleDeepLinkIntent(Intent intent) {
        if (intent == null)
            return;
        String jobId = intent.getStringExtra("jobId");
        String notificationType = intent.getStringExtra("notificationType");
        if (jobId != null && !jobId.isEmpty() && notificationType != null && !notificationType.isEmpty()) {
            String json = "{\"type\":\"" + notificationType + "\",\"jobId\":\"" + jobId + "\"}";
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit().putString("pendingDeepLink", json).apply();
            Log.d("NeedYouFCM", "Deep-link stored: " + json);
        }
    }

    /**
     * Called when a notification is tapped while the app is already in the
     * foreground or background (not killed). Stores the deep-link AND dispatches
     * a JS CustomEvent so the React app can react immediately.
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLinkIntent(intent);

        final String jobId = intent.getStringExtra("jobId");
        final String notificationType = intent.getStringExtra("notificationType");
        if (jobId != null && !jobId.isEmpty() && notificationType != null && !notificationType.isEmpty()) {
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                String js = "window.dispatchEvent(new CustomEvent('needyou_deep_link'," +
                        "{detail:{type:'" + notificationType + "',jobId:'" + jobId + "'}}))";
                wv.post(() -> wv.evaluateJavascript(js, null));
            }
        }
    }

    // ─── File chooser result ─────────────────────────────────────────────────

    /** Launches ACTION_IMAGE_CAPTURE — opens camera app in PHOTO mode. */
    private void launchCameraForPhoto() {
        File photoFile = null;
        try {
            String ts = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
            File dir = getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES);
            photoFile = File.createTempFile("IMG_" + ts, ".jpg", dir);
        } catch (IOException e) {
            Log.e("NeedYou", "Camera temp file error", e);
            if (fileUploadCallback != null) {
                fileUploadCallback.onReceiveValue(null);
                fileUploadCallback = null;
            }
            return;
        }
        cameraImageUri = androidx.core.content.FileProvider.getUriForFile(
                this, getPackageName() + ".fileprovider", photoFile);
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            startActivityForResult(intent, CAMERA_CAPTURE_REQUEST_CODE);
        } catch (ActivityNotFoundException e) {
            Log.e("NeedYou", "No camera app", e);
            if (fileUploadCallback != null) {
                fileUploadCallback.onReceiveValue(null);
                fileUploadCallback = null;
            }
        }
    }

    /** Launches ACTION_VIDEO_CAPTURE — opens camera app in VIDEO RECORDING mode. */
    private void launchCameraForVideo() {
        Intent intent = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
        intent.putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1); // high quality
        try {
            startActivityForResult(intent, VIDEO_CAPTURE_REQUEST_CODE);
        } catch (ActivityNotFoundException e) {
            Log.e("NeedYou", "No camera app for video", e);
            if (fileUploadCallback != null) {
                fileUploadCallback.onReceiveValue(null);
                fileUploadCallback = null;
            }
        }
    }

    /** Launches the system file/media picker for WebView file inputs (gallery). */
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

        // ── Photo captured via ACTION_IMAGE_CAPTURE ──────────────────────────
        if (requestCode == CAMERA_CAPTURE_REQUEST_CODE) {
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && cameraImageUri != null) {
                results = new Uri[] { cameraImageUri };
            }
            cameraImageUri = null;
            if (fileUploadCallback != null) {
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
            return;
        }

        // ── Video captured via ACTION_VIDEO_CAPTURE ──────────────────────────
        if (requestCode == VIDEO_CAPTURE_REQUEST_CODE) {
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                results = new Uri[] { data.getData() };
            }
            if (fileUploadCallback != null) {
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
            return;
        }

        // ── Gallery / file picker ────────────────────────────────────────────
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

        if (requestCode == CAMERA_PERMISSION_CODE) {
            // Grant or deny the pending WebView camera permission request
            if (pendingCameraPermissionRequest != null) {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    pendingCameraPermissionRequest.grant(pendingCameraPermissionRequest.getResources());
                } else {
                    pendingCameraPermissionRequest.deny();
                }
                pendingCameraPermissionRequest = null;
            }
            return;
        }

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
        // Show AT MOST ONCE per Activity instance lifecycle.
        // onResume fires every time the user returns from Settings, which would
        // otherwise re-show the dialog in a loop.
        if (batteryDialogShown)
            return;
        batteryDialogShown = true;

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

        // ── Always load the dashboard URL directly ──────────────────────────────
        // The native Firebase Android SDK uses a SEPARATE session store from the
        // React Web SDK (which persists in IndexedDB). Calling getCurrentUser()
        // here always returns null for web-authenticated users, causing an
        // incorrect redirect to /signin that the user sees as a 2-second flash.
        //
        // All routing is handled correctly by React:
        // • AuthContext.onAuthStateChanged restores the Web SDK session from IndexedDB
        // • dashboard/page.tsx checks kycVerified → onboardingComplete → location
        // • signin/page.tsx redirects away if a session already exists
        //
        // Just load the dashboard and let React route from there.
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
