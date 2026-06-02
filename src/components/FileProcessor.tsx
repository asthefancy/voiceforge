import { useCallback, useRef, useState } from "react";
import { Upload, Download, Play, Loader2, FileAudio, FileVideo } from "lucide-react";
import type { EffectNodeConfig, EnvelopePoint } from "@/types";
import { renderOffline } from "@/lib/audioEngine";
import { audioBufferToWav, sliceAudioBuffer } from "@/lib/wav";
import { extractAudioFromVideo, remuxVideoWithAudio } from "@/lib/ffmpeg";
import { saveBlob } from "@/lib/native";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WaveformEditor } from "@/components/WaveformEditor";

interface Props {
  chain: EffectNodeConfig[];
  inputGainDb: number;
  outputGainDb: number;
}

type Stage = "idle" | "loading" | "ready" | "processing" | "done";

interface Loaded {
  file: File;
  isVideo: boolean;
  buffer: AudioBuffer;
}

/**
 * ファイル処理モード（差別化機能: 動画完全統合）。
 * 音声ファイル: オフライン変換 → WAV ダウンロード。
 * 動画ファイル: 音声抽出 → 変換 → 元動画へ再合成 → MP4 ダウンロード。
 */
export function FileProcessor({ chain, inputGainDb, outputGainDb }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  // 音声ファイルのトリム範囲(秒)。動画は映像との同期維持のためトリムしない。
  const [range, setRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  // ゲインエンベロープ（キーポイント）。t は選択範囲に対する正規化時刻。
  const [envelope, setEnvelope] = useState<EnvelopePoint[]>([]);
  const resultBlobRef = useRef<{ blob: Blob; filename: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    revokeResult();
    setResultUrl(null);
    setStage("loading");
    setStatus("読み込み中…");

    try {
      const isVideo = file.type.startsWith("video/");
      let arrayBuf: ArrayBuffer;
      if (isVideo) {
        setStatus("動画から音声を抽出中…");
        const wav = await extractAudioFromVideo(file, (r) => setProgress(r));
        arrayBuf = wav.slice().buffer;
      } else {
        arrayBuf = await file.arrayBuffer();
      }
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuf);
      await ctx.close();
      setLoaded({ file, isVideo, buffer });
      setRange({ start: 0, end: buffer.duration });
      setStage("ready");
      setStatus("");
      setProgress(0);
    } catch (err) {
      console.error(err);
      setStatus("読み込みに失敗しました。別のファイルでお試しください。");
      setStage("idle");
    }
  };

  const process = async () => {
    if (!loaded) return;
    setStage("processing");
    setProgress(0);
    revokeResult();
    setResultUrl(null);

    try {
      setStatus("エフェクトをオフライン適用中…");
      // 音声ファイルは選択範囲だけを書き出す（動画は同期維持のため全体）
      const trimmed =
        !loaded.isVideo && (range.start > 0.01 || range.end < loaded.buffer.duration - 0.01)
          ? sliceAudioBuffer(loaded.buffer, range.start, range.end)
          : loaded.buffer;
      // エンベロープは音声ファイルのみ（動画は全体・無加工）
      const env = loaded.isVideo ? undefined : envelope;
      const rendered = await renderOffline(trimmed, chain, inputGainDb, outputGainDb, env);
      const wavBlob = audioBufferToWav(rendered);

      if (loaded.isVideo) {
        setStatus("元動画へ音声を再合成中…");
        const wavBytes = new Uint8Array(await wavBlob.arrayBuffer());
        const mp4 = await remuxVideoWithAudio(loaded.file, wavBytes, (r) => setProgress(r));
        const filename = renameExt(loaded.file.name, "voiceforge", "mp4");
        resultBlobRef.current = { blob: mp4, filename };
        setResultUrl(URL.createObjectURL(mp4));
      } else {
        const filename = renameExt(loaded.file.name, "voiceforge", "wav");
        resultBlobRef.current = { blob: wavBlob, filename };
        setResultUrl(URL.createObjectURL(wavBlob));
      }
      setStatus("");
      setStage("done");
    } catch (err) {
      console.error(err);
      setStatus("処理に失敗しました。");
      setStage("ready");
    }
  };

  const download = async () => {
    const r = resultBlobRef.current;
    if (!r) return;
    const uri = await saveBlob(r.filename, r.blob);
    if (uri) setStatus(`保存しました: ${uri}`);
  };

  const revokeResult = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  };

  const handleRange = useCallback((start: number, end: number) => setRange({ start, end }), []);
  const handleEnvelope = useCallback((points: EnvelopePoint[]) => setEnvelope(points), []);

  const busy = stage === "loading" || stage === "processing";

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={onPick}
      />

      <Card className="p-4">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 transition-colors hover:bg-secondary/40 disabled:opacity-50"
        >
          <Upload className="h-7 w-7 text-accent" />
          <span className="text-sm font-medium">音声・動画ファイルを選択</span>
          <span className="text-[11px] text-muted-foreground">
            mp3 / wav / m4a / mp4 / mov など（端末内で処理）
          </span>
        </button>

        {loaded && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary/40 p-3">
            {loaded.isVideo ? <FileVideo className="h-5 w-5 text-accent" /> : <FileAudio className="h-5 w-5 text-accent" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{loaded.file.name}</p>
              <p className="text-[11px] text-muted-foreground">長さ {formatTime(loaded.buffer.duration)}</p>
            </div>
          </div>
        )}
      </Card>

      {loaded && !loaded.isVideo && (stage === "ready" || stage === "done") && (
        <Card className="space-y-2 p-4">
          <p className="text-sm font-semibold">トリム / プレビュー</p>
          <WaveformEditor
            buffer={loaded.buffer}
            onRangeChange={handleRange}
            onEnvelopeChange={handleEnvelope}
          />
        </Card>
      )}

      {busy && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status}
          </div>
          {progress > 0 && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {!busy && status && <p className="text-sm text-muted-foreground">{status}</p>}

      {loaded && (stage === "ready" || stage === "done") && (
        <Button className="w-full" size="lg" onClick={process}>
          {chain.filter((c) => c.enabled).length === 0 ? "（エフェクト無しで）変換" : "エフェクトを適用して変換"}
        </Button>
      )}

      {stage === "done" && resultUrl && (
        <Card className="space-y-3 p-4">
          <p className="text-sm font-semibold">変換完了</p>
          {loaded?.isVideo ? (
            <video src={resultUrl} controls playsInline className="w-full rounded-xl" />
          ) : (
            <audio src={resultUrl} controls className="w-full">
              <track kind="captions" />
            </audio>
          )}
          <div className="flex gap-2">
            {!loaded?.isVideo && (
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => new Audio(resultUrl).play()}
              >
                <Play /> 再生
              </Button>
            )}
            <Button className="flex-1" onClick={download}>
              <Download /> 保存
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function renameExt(original: string, suffix: string, ext: string): string {
  const base = original.replace(/\.[^.]+$/, "");
  return `${base}_${suffix}.${ext}`;
}
