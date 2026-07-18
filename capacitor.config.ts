import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rememberone.app",
  appName: "RememberOne",
  webDir: "public",
  server: {
    url: "https://rememberone.online",
    allowNavigation: ["*.supabase.co", "accounts.google.com"],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "Default",
      backgroundColor: "#ffffff",
    },
    LocalNotifications: {
      // iOS: show pre-meeting notifications even while the app is foreground.
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
  android: {
    // No HTTP subresources on any page we load — enforce HTTPS-only.
    allowMixedContent: false,
    // Android plugin ALLOWLIST (overrides the package.json auto-detection).
    // @capacitor-community/apple-sign-in is deliberately absent: Sign in with
    // Apple is iOS-only in this app, and the plugin's v7-era Android
    // build.gradle uses getDefaultProguardFile('proguard-android.txt'), which
    // the current Android Gradle Plugin rejects — including it breaks the AAB
    // build. NOTE: any NEW plugin must be added here too or Android won't
    // ship it (iOS is unaffected — no iOS allowlist is set).
    includePlugins: [
      "@capacitor-community/speech-recognition",
      "@capacitor/app",
      "@capacitor/browser",
      "@capacitor/filesystem",
      "@capacitor/local-notifications",
      "@capacitor/preferences",
      "@capacitor/share",
      "@capacitor/splash-screen",
      "@capacitor/status-bar",
      "@ebarooni/capacitor-calendar",
    ],
  },
  ios: {
    contentInset: "always",
    scrollEnabled: true,
  },
};

export default config;
