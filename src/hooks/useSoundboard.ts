import { useCallback, useEffect, useState } from "react";
import type { SoundClip } from "@/types";
import type { AudioEngine } from "@/lib/audioEngine";
import { clipStore } from "@/lib/storage";
import { haptic } from "@/lib/native";
import { audioBufferToWav } from "@/lib/wav";

export interface PendingClip {
  blob: Blob;
  duration: number;
}

type ShowToast = (message: string, variant?: "info" | "success" | "error") => void;

/**
 * サウンドボードの状態（クリップ一覧）と録音フローを集約する共有フック。
 * 録音はリアルタイムタブから開始し、保存するとボードの一覧にも即反映される。
 * クリップ一覧の単一の真実をここに置くことで、複数タブ間で連動させる。
 */
export function useSoundboard(engine: AudioEngine, ensureMic: () => Promise<boolean>, toast: ShowToast) {
  const [clips, setClips] = useState<SoundClip[]>([]);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<PendingClip | null>(null);

  // IndexedDB から読み込み（旧 localStorage 分は自動移行）
  useEffect(() => {
    let alive = true;
    void clipStore.all().then((c) => {
      if (alive) setClips(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  const startRecording = useCallback(async () => {
    const ok = await ensureMic();
    if (!ok) return;
    await engine.startRecording();
    await haptic();
    setRecording(true);
  }, [engine, ensureMic]);

  const stopRecording = useCallback(async () => {
    const blob = await engine.stopRecording();
    setRecording(false);
    if (!blob) return;
    // 録音(webm/opus)を PCM へ展開し WAV に変換（どこでも再生できる形式で保存）。
    const wav = await transcodeToWav(blob);
    if (wav) {
      setPending({ blob: wav.blob, duration: wav.duration });
    } else {
      // 変換不可な環境では元データのまま保存（後方互換）
      const duration = await getDuration(blob);
      setPending({ blob, duration });
    }
  }, [engine]);

  const savePending = useCallback(
    (name: string, tags: string[]) => {
      if (!pending) return;
      const clip: SoundClip = {
        id: `clip-${Date.now().toString(36)}`,
        name,
        tags,
        blob: pending.blob,
        durationSec: pending.duration,
        createdAt: Date.now(),
      };
      void clipStore
        .save(clip)
        .then((c) => {
          setClips(c);
          toast("クリップを保存しました", "success");
        })
        .catch(() => toast("保存に失敗しました。ストレージ空き容量をご確認ください。", "error"));
      setPending(null);
    },
    [pending, toast],
  );

  const discardPending = useCallback(() => setPending(null), []);

  const removeClip = useCallback((id: string) => void clipStore.remove(id).then(setClips), []);

  return { clips, recording, startRecording, stopRecording, pending, savePending, discardPending, removeClip };
}

/**
 * 録音 Blob(webm/opus 等) を decodeAudioData で PCM 展開し WAV へ変換。
 * 同時に正確な長さ(秒)も得られる。失敗時は null（呼び出し側でフォールバック）。
 */
async function transcodeToWav(blob: Blob): Promise<{ blob: Blob; duration: number } | null> {
  try {
    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    await ctx.close();
    return { blob: audioBufferToWav(buffer), duration: buffer.duration };
  } catch {
    return null;
  }
}

/** Blob の音声長を取得（取得不能なら 0）。一時 object URL は必ず revoke する。 */
function getDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const done = () => finish(isFinite(audio.duration) ? audio.duration : 0);
    audio.addEventListener("loadedmetadata", done, { once: true });
    audio.addEventListener("error", () => finish(0), { once: true });
    setTimeout(() => finish(isFinite(audio.duration) ? audio.duration : 0), 1500);
  });
}
