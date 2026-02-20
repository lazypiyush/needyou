package com.needyou.app;

import android.Manifest;
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
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int NOTIFICATION_PERMISSION_CODE = 1001;
    private static final String APP_URL = "https://need-you.xyz/signin";
    private static final String OFFLINE_URL = "file:///android_asset/offline.html";

    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean isShowingOfflinePage = false;

    // Called by the Retry button in offline.html: NeedYouBridge.retry()
    public class NeedYouBridge {
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
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Request notification permission natively on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[] { Manifest.permission.POST_NOTIFICATIONS },
                        NOTIFICATION_PERMISSION_CODE);
            }
        }

        // 2. Expose NeedYouBridge to the WebView (for offline.html Retry button)
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new NeedYouBridge(), "NeedYouBridge");

        // 3. Show offline page immediately if no internet on startup
        if (!isNetworkAvailable()) {
            loadOffline();
        }

        // 4. Listen for network changes throughout the session
        registerNetworkCallback();
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

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
                // Internet restored — reload app if we were on the offline page
                if (isShowingOfflinePage) {
                    runOnUiThread(() -> loadApp());
                }
            }

            @Override
            public void onLost(Network network) {
                // Connection dropped — switch to offline page
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
