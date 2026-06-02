import { defineConfig } from "vitest/config";
import path from "node:path";

// 純粋関数（DOM/AudioContext 非依存）のユニットテスト設定。
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
