import { createRoot } from "react-dom/client";
import App from "@/App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/ui/toast";
import { initNative } from "@/lib/native";
import "@/index.css";

// ネイティブ初期化（Web では no-op）
void initNative();

const root = document.getElementById("root");
if (!root) throw new Error("root element not found");

// 注: StrictMode は付けない。開発時の二重 effect が AudioContext/Tone ノードの
// 生成・破棄を二重化し、マイク/音声経路を不安定にするため（オーディオアプリの定石）。
createRoot(root).render(
  <ErrorBoundary>
    <ToastProvider>
      <App />
    </ToastProvider>
  </ErrorBoundary>,
);
