import { Capacitor } from "@capacitor/core";

/**
 * Capacitor ネイティブ連携。Web/PWA では全てフォールバックし、
 * iOS/Android 実機ではネイティブ API を使う。
 * 動的 import によりプラグイン未導入のWeb環境でも安全に動く。
 */

export const isNative = Capacitor.isNativePlatform();

export async function initNative(): Promise<void> {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* StatusBar 未対応プラットフォーム */
  }
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* noop */
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:...;base64, を除去
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Blob を保存。
 * - Web/PWA: a要素でダウンロード。
 * - ネイティブ: Documents ディレクトリへ書き込み、保存先 uri を返す。
 */
export async function saveBlob(filename: string, blob: Blob): Promise<string | null> {
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // メモリ解放
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return null;
  }

  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const base64 = await blobToBase64(blob);
  const res = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });
  return res.uri;
}

/** 触覚フィードバック（対応端末のみ） */
export async function haptic(): Promise<void> {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* noop */
  }
}
