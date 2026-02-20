import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.needyou.app',
  appName: 'NeedYou',
  webDir: 'out',

  // ✅ Load your live Vercel app inside the native shell
  // Replace this URL with your actual Vercel deployment URL
  server: {
    url: 'https://need-you.xyz',
    cleartext: false,
    androidScheme: 'https',
    // Keep ALL navigation inside the WebView — prevents Chrome from opening
    allowNavigation: [
      'need-you.xyz',
      '*.need-you.xyz',
      'need-you.vercel.app',
    ],
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
  },

  android: {
    // Allows debugging via Chrome DevTools when running debug builds
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
