import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// ffmpeg.wasm (マルチスレッド版) は SharedArrayBuffer を要求するため
// Cross-Origin Isolation ヘッダーが必須。dev/preview の両方で付与する。
const crossOriginIsolation = {
  name: "cross-origin-isolation",
  configureServer(server: { middlewares: { use: (fn: (req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      next();
    });
  },
};

// GitHub Pages はサブパス配信（例: /voiceforge/）。
// デプロイ用 workflow が GHPAGES_BASE を渡す。ローカル/Capacitor は "/" のまま。
const base = process.env.GHPAGES_BASE || "/";

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    crossOriginIsolation,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "VoiceForge",
        short_name: "VoiceForge",
        description: "完全あなたの端末内で動作する本格ボイスチェンジャー",
        theme_color: "#0b0b12",
        background_color: "#0b0b12",
        display: "standalone",
        orientation: "portrait",
        // 相対指定にすることでルート配信(/)とサブパス配信(/voiceforge/)の両方で正しく動く
        start_url: ".",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // ffmpeg-core(.wasm) は大きいので明示的にキャッシュ許可
        maximumFileSizeToCacheInBytes: 64 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ffmpeg/util などの依存最適化で詰まらないよう除外
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    port: 4173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    target: "es2021",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // 大きめの依存をベンダーチャンクに分離し初期表示を軽くする
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // UI 系を先に判定（@radix-ui/react-* が react 判定に吸われないように）
          if (id.includes("@radix-ui") || id.includes("@dnd-kit")) return "ui";
          if (id.includes("/tone/")) return "tone";
          if (id.includes("@ffmpeg")) return "ffmpeg";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/"))
            return "react";
        },
      },
    },
  },
});
