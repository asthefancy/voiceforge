import type { Preset } from "@/types";

/**
 * プリセットを URL ハッシュで共有する。
 * JSON → UTF-8 安全な base64url へエンコードし、`#p=...` に載せる。
 * サーバー不要・完全クライアントサイド。
 */

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 共有用に最小化したプリセット表現（id は受信側で振り直す） */
interface SharePayload {
  n: string;
  ig: number;
  og: number;
  c: { k: string; e: boolean; p: Record<string, number> }[];
}

export function encodePreset(preset: Preset): string {
  const payload: SharePayload = {
    n: preset.name,
    ig: preset.inputGainDb,
    og: preset.outputGainDb,
    c: preset.chain.map((e) => ({ k: e.kind, e: e.enabled, p: e.params })),
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

export function decodePreset(encoded: string): Preset | null {
  try {
    const bytes = fromBase64Url(encoded);
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as SharePayload;
    return {
      id: `shared-${Date.now().toString(36)}`,
      name: payload.n || "共有プリセット",
      inputGainDb: payload.ig ?? 0,
      outputGainDb: payload.og ?? 0,
      chain: payload.c.map((e, i) => ({
        id: `${e.k}-shared-${i}`,
        kind: e.k as Preset["chain"][number]["kind"],
        enabled: e.e,
        params: e.p,
      })),
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(preset: Preset): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#p=${encodePreset(preset)}`;
}

/** 現在の URL ハッシュから共有プリセットを取り出す（あれば） */
export function readSharedPresetFromUrl(): Preset | null {
  const m = location.hash.match(/[#&]p=([^&]+)/);
  if (!m) return null;
  return decodePreset(m[1]);
}
