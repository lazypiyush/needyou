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
      // DigiLocker / Surepass KYC domains
      'digilocker.gov.in',
      '*.digilocker.gov.in',
      'api.digitallocker.gov.in',
      'surepass.io',
      '*.surepass.io',
      'cdn.jsdelivr.net',
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
      backgroundColor: '#00000000', // fully transparent
      // overlaysWebView: true makes the app draw behind the status bar AND nav bar
      // So the web content fills the entire screen edge-to-edge.
      // env(safe-area-inset-*) CSS vars compensate so content isn't hidden.
      overlaysWebView: true,
    },
    // NavigationBar: transparent + overlay so the 3-button bar (back/home/recents)
    // draws OVER the web content rather than shrinking the viewport.
    // This is the same immersive behaviour as splashImmersive: true.
    NavigationBar: {
      backgroundColor: '#00000000',
      visible: false,
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
