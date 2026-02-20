import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.needyou.app',
  appName: 'NeedYou',
  webDir: 'out',

  // ✅ Load your live Vercel app inside the native shell
  // Replace this URL with your actual Vercel deployment URL
  server: {
    url: 'https://need-you.xyz/signin',
    cleartext: false,
    androidScheme: 'https',
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
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
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
