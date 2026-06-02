import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Trash2, Search, Tag, Share2 } from "lucide-react";
import type { SoundClip } from "@/types";
import { saveBlob, haptic } from "@/lib/native";
import { formatTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  clips: SoundClip[];
  onRemove: (id: string) => void;
}

/**
 * サウンドボード（ライブラリ）。保存済みクリップの検索・再生・共有・削除に専念。
 * 録音はリアルタイムタブから行い、結果はここに反映される（state は useSoundboard が保持）。
 */
export function Soundboard({ clips, onRemove }: Props) {
  const [query, setQuery] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 再生中に作った object URL。次回再生/アンマウントで必ず revoke しリークを防ぐ。
  const playUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
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

  /** クリップを共有（Web Share API 対応端末）または保存（ダウンロード/アプリ内保存）。 */
  const exportClip = async (clip: SoundClip) => {
    const blob = clip.blob ?? (clip.dataUrl ? await (await fetch(clip.dataUrl)).blob() : null);
    if (!blob) return;
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
    const filename = `${clip.name.replace(/[\\/:*?"<>|]/g, "_")}.${ext}`;

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
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="名前・タグで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {clips.length === 0
            ? "「リアルタイム」タブの録音ボタンで、加工後の声を録音できます"
            : "一致するクリップがありません"}
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
                className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onRemove(clip.id)}
                aria-label="削除"
                className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
