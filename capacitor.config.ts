import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.voiceforge.app",
  appName: "VoiceForge",
  webDir: "dist",
  // すべて端末内で完結するためサーバー設定は不要。
  // 開発中に実機ライブリロードを使いたい場合のみ server.url を指定する。
  ios: {
    contentInset: "always",
    // マイク等の低遅延入出力のため WKWebView の音声制御を許可
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0b0b12",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0b12",
      overlaysWebView: false,
    },
  },
};

export default config;
