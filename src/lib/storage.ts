import type { Preset, SoundClip } from "@/types";
import { idb } from "@/lib/idb";

/**
 * 端末内永続化レイヤ。
 * - サウンドボードのクリップ: IndexedDB（大量・大容量に対応＝「無制限」）。
 * - ユーザープリセット: 小さいので localStorage のまま。
 * いずれも外部送信は無し。
 */

const CLIPS_KEY = "voiceforge.clips.v1"; // 旧 localStorage キー（移行用）
const CLIPS_STORE = "clips";
const PRESETS_KEY = "voiceforge.presets.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // 容量超過など。呼び出し側で握れるよう再スロー。
    throw e instanceof Error ? e : new Error("storage write failed");
  }
}

/**
 * 旧バージョンの localStorage 保存分があれば IndexedDB へ一度だけ移行する。
 */
async function migrateClipsIfNeeded(): Promise<void> {
  const legacy = read<SoundClip[]>(CLIPS_KEY, []);
  if (legacy.length === 0) return;
  for (const clip of legacy) await idb.put(CLIPS_STORE, clip);
  localStorage.removeItem(CLIPS_KEY);
}

export const clipStore = {
  /** 全クリップを新しい順で返す（IndexedDB は順序保証しないため createdAt でソート） */
  async all(): Promise<SoundClip[]> {
    await migrateClipsIfNeeded();
    const clips = await idb.getAll<SoundClip>(CLIPS_STORE);
    return clips.sort((a, b) => b.createdAt - a.createdAt);
  },
  async save(clip: SoundClip): Promise<SoundClip[]> {
    await idb.put(CLIPS_STORE, clip);
    return this.all();
  },
  async remove(id: string): Promise<SoundClip[]> {
    await idb.delete(CLIPS_STORE, id);
    return this.all();
  },
  async update(id: string, patch: Partial<SoundClip>): Promise<SoundClip[]> {
    const current = await this.all();
    const target = current.find((c) => c.id === id);
    if (target) await idb.put(CLIPS_STORE, { ...target, ...patch });
    return this.all();
  },
};

export const presetStore = {
  all(): Preset[] {
    return read<Preset[]>(PRESETS_KEY, []);
  },
  saveAll(presets: Preset[]): void {
    write(PRESETS_KEY, presets);
  },
  upsert(preset: Preset): Preset[] {
    const existing = this.all();
    const idx = existing.findIndex((p) => p.id === preset.id);
    const next = idx >= 0 ? existing.map((p) => (p.id === preset.id ? preset : p)) : [preset, ...existing];
    write(PRESETS_KEY, next);
    return next;
  },
  remove(id: string): Preset[] {
    const next = this.all().filter((p) => p.id !== id);
    write(PRESETS_KEY, next);
    return next;
  },
};
