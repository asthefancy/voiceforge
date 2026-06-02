import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Play, Trash2, Search, Tag, Share2 } from "lucide-react";
import type { SoundClip } from "@/types";
import type { AudioEngine } from "@/lib/audioEngine";
import { clipStore } from "@/lib/storage";
import { haptic, saveBlob } from "@/lib/native";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  engine: AudioEngine;
  /** マイク入力を確保する（未許可なら権限要求）。成功で true。 */
  ensureMic: () => Promise<boolean>;
}

/**
 * 無制限サウンドボード（差別化機能）。
 * 加工後の自分の声を録音→タグ付き保存→検索→ワンクリック再生。完全端末内。
 */
export function Soundboard({ engine, ensureMic }: Props) {
  const [clips, setClips] = useState<SoundClip[]>([]);
  const [recording, setRecording] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ blob: Blob; duration: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 再生中に作った object URL。次回再生/アンマウントで必ず revoke しリークを防ぐ。
  const playUrlRef = useRef<string | null>(null);

  // IndexedDB から読み込み（旧 localStorage 分は自動移行）
  useEffect(() => {
    let alive = true;
    void clipStore.all().then((c) => {
      if (alive) setClips(c);
    });
    return () => {
      alive = false;
      audioRef.current?.pause();
      if (playUrlRef.current) URL.revokeObjectURL(playUrlRef.current);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter(
      (c) => c.name.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [clips, query]);

  const startRec = async () => {
    const ok = await ensureMic();
    if (!ok) return;
    await engine.startRecording();
    await haptic();
    setRecording(true);
  };

  const stopRec = async () => {
    const blob = await engine.stopRecording();
    setRecording(false);
    if (!blob) return;
    const duration = await getDuration(blob);
    setPending({ blob, duration });
  };

  const play = (clip: SoundClip) => {
    audioRef.current?.pause();
    if (playUrlRef.current) URL.revokeObjectURL(playUrlRef.current);

    // 新クリップは Blob、旧クリップは dataUrl をフォールバックで使用
    const src = clip.blob ? URL.createObjectURL(clip.blob) : clip.dataUrl;
    if (!src) return;
    playUrlRef.current = clip.blob ? src : null;

    const audio = new Audio(src);
    audioRef.current = audio;
    void audio.play();
    void haptic();
  };

  const remove = (id: string) => void clipStore.remove(id).then(setClips);

  /** クリップを共有（Web Share API 対応端末）または保存（ダウンロード/アプリ内保存）。 */
  const exportClip = async (clip: SoundClip) => {
    // 新クリップは Blob、旧クリップは dataUrl から Blob を復元
    const blob = clip.blob ?? (clip.dataUrl ? await (await fetch(clip.dataUrl)).blob() : null);
    if (!blob) return;
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
    const filename = `${clip.name.replace(/[\\/:*?"<>|]/g, "_")}.${ext}`;

    // 対応端末ではファイル共有を優先
    const file = new File([blob], filename, { type: blob.type || "audio/webm" });
    const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (navAny.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: clip.name });
        await haptic();
        return;
      } catch {
        // 共有キャンセル等は保存にフォールバック
      }
    }
    await saveBlob(filename, blob);
    await haptic();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="名前・タグで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {recording ? (
          <Button variant="destructive" size="icon" onClick={stopRec} aria-label="録音停止">
            <Square />
          </Button>
        ) : (
          <Button variant="accent" size="icon" onClick={startRec} aria-label="録音開始">
            <Mic />
          </Button>
        )}
      </div>

      {recording && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
          録音中… 加工後の声をキャプチャしています
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {clips.length === 0 ? "マイクボタンで最初のフレーズを録音しましょう" : "一致するクリップがありません"}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((clip) => (
            <Card key={clip.id} className="flex items-center gap-3 p-3">
              <Button variant="secondary" size="icon" onClick={() => play(clip)} aria-label="再生">
                <Play />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{clip.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">{formatTime(clip.durationSec)}</span>
                  {clip.tags.map((t) => (
                    <Badge key={t} className="gap-1 py-0">
                      <Tag className="h-2.5 w-2.5" /> {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <button
                onClick={() => void exportClip(clip)}
                aria-label="共有・保存"
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(clip.id)}
                aria-label="削除"
                className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      <SaveClipDialog
        pending={pending}
        onClose={() => setPending(null)}
        onSave={(name, tags) => {
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
            .then(setClips)
            .catch(() => alert("保存に失敗しました。ストレージ空き容量をご確認ください。"));
          setPending(null);
        }}
      />
    </div>
  );
}

function SaveClipDialog({
  pending,
  onClose,
  onSave,
}: {
  pending: { blob: Blob; duration: number } | null;
  onClose: () => void;
  onSave: (name: string, tags: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (pending) {
      setName(`フレーズ ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`);
      setTags("");
    }
  }, [pending]);

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">録音を保存</DialogTitle>
        </DialogHeader>
        <Input placeholder="フレーズ名" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="タグ（カンマ区切り 例: ロボット, 挨拶）"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            破棄
          </Button>
          <Button
            className="flex-1"
            disabled={!name.trim()}
            onClick={() =>
              onSave(
                name.trim(),
                tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              )
            }
          >
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
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
