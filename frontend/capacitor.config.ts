import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.needyou.app',
  appName: 'NeedYou',
  webDir: 'out',

  // ✅ Load your live Vercel app inside the native shell
  // Replace this URL with your actual Vercel deployment URL
  server: {
    url: 'https://need-you.xyz/dashboard',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'need-you.xyz',
      '*.need-you.xyz',
      'need-you.vercel.app',
      'razorpay.com',
      '*.razorpay.com',
      'api.razorpay.com',
      'checkout.razorpay.com',
    ],
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchFadeOutDuration: 400,
      autoHide: true,
      backgroundColor: '#0f172a',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
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
