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
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "always",
    scrollEnabled: true,
  },
};

export default config;
