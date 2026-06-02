import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Repeat, Scissors, SlidersHorizontal, RotateCcw } from "lucide-react";
import type { EnvelopePoint } from "@/types";
import { computePeaks } from "@/lib/wav";
import { clamp, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  buffer: AudioBuffer;
  /** トリム範囲(秒)が変わるたびに通知 */
  onRangeChange: (startSec: number, endSec: number) => void;
  /** ゲインエンベロープ（キーポイント）が変わるたびに通知 */
  onEnvelopeChange: (points: EnvelopePoint[]) => void;
}

const BUCKETS = 700;
const HIT_PX = 20;
const LONG_PRESS_MS = 500;
const FLAT: EnvelopePoint[] = [
  { t: 0, gain: 1 },
  { t: 1, gain: 1 },
];

type Mode = "trim" | "env";

/**
 * 波形ビジュアルエディタ（差別化機能）。
 * - trim モード: 左右ハンドルで書き出し範囲を指定
 * - env モード: 波形上にキーポイントを置き、ゲインエンベロープ（フェード/抑揚）を作成
 *   （タップで追加 / ドラッグで移動 / 中間点を長押しで削除）
 * いずれも選択範囲 = 書き出し対象。エンベロープの t は選択範囲に対する正規化時刻。
 */
export function WaveformEditor({ buffer, onRangeChange, onEnvelopeChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaks = useMemo(() => computePeaks(buffer, BUCKETS), [buffer]);
  const duration = buffer.duration;

  const [mode, setMode] = useState<Mode>("trim");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);
  const [points, setPoints] = useState<EnvelopePoint[]>(FLAT);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);

  const dragKindRef = useRef<"start" | "end" | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const longPressRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewGainRef = useRef<GainNode | null>(null);

  // buffer が変わったら状態をリセット
  useEffect(() => {
    setStart(0);
    setEnd(buffer.duration);
    setPoints(FLAT);
  }, [buffer]);

  useEffect(() => onRangeChange(start, end), [start, end, onRangeChange]);
  useEffect(() => onEnvelopeChange(points), [points, onEnvelopeChange]);

  // 描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const mid = h / 2;
    const startX = (start / duration) * w;
    const endX = (end / duration) * w;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, startX, h);
    ctx.fillRect(endX, 0, w - endX, h);

    for (let i = 0; i < BUCKETS; i++) {
      const x = (i / BUCKETS) * w;
      const inRange = x >= startX && x <= endX;
      ctx.strokeStyle = inRange ? "#22d3ee" : "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.moveTo(x, mid + peaks.min[i] * mid * 0.95);
      ctx.lineTo(x, mid + peaks.max[i] * mid * 0.95);
      ctx.stroke();
    }

    if (mode === "trim") {
      ctx.fillStyle = "#8b5cf6";
      ctx.fillRect(startX - 1, 0, 2, h);
      ctx.fillRect(endX - 1, 0, 2, h);
      for (const hx of [startX, endX]) {
        ctx.beginPath();
        ctx.arc(hx, mid, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // エンベロープ折れ線（選択範囲内にマップ）
      const px = (p: EnvelopePoint) => startX + p.t * (endX - startX);
      const py = (p: EnvelopePoint) => h - p.gain * h;
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((p, i) => (i === 0 ? ctx.moveTo(px(p), py(p)) : ctx.lineTo(px(p), py(p))));
      ctx.stroke();
      ctx.lineWidth = 1;
      points.forEach((p, i) => {
        ctx.fillStyle = i === 0 || i === points.length - 1 ? "#8b5cf6" : "#22d3ee";
        ctx.beginPath();
        ctx.arc(px(p), py(p), 7, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [peaks, start, end, duration, mode, points]);

  const xToSec = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      return clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
    },
    [duration],
  );

  // env モード用: クライアント座標 → (t, gain)
  const toEnv = useCallback(
    (clientX: number, clientY: number): EnvelopePoint => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const sec = clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
      const t = end > start ? clamp((sec - start) / (end - start), 0, 1) : 0;
      const gain = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
      return { t, gain };
    },
    [duration, start, end],
  );

  const clearLongPress = () => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    movedRef.current = false;

    if (mode === "trim") {
      const sec = xToSec(e.clientX);
      dragKindRef.current = Math.abs(sec - start) <= Math.abs(sec - end) ? "start" : "end";
      onPointerMove(e);
      return;
    }

    // env モード: 最近傍点を判定
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const startX = (start / duration) * w;
    const endX = (end / duration) * w;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    let hit = -1;
    let bestDist = HIT_PX;
    points.forEach((p, i) => {
      const px = startX + p.t * (endX - startX);
      const py = h - p.gain * h;
      const d = Math.hypot(px - localX, py - localY);
      if (d < bestDist) {
        bestDist = d;
        hit = i;
      }
    });

    if (hit >= 0) {
      dragIdxRef.current = hit;
      // 中間点は長押しで削除
      if (hit > 0 && hit < points.length - 1) {
        longPressRef.current = window.setTimeout(() => {
          setPoints((prev) => prev.filter((_, i) => i !== hit));
          dragIdxRef.current = null;
          longPressRef.current = null;
        }, LONG_PRESS_MS);
      }
    } else {
      // 空き領域 → 新規点を追加（t 昇順を維持）
      const np = toEnv(e.clientX, e.clientY);
      setPoints((prev) => {
        const next = [...prev, np].sort((a, b) => a.t - b.t);
        dragIdxRef.current = next.findIndex((p) => p === np);
        return next;
      });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode === "trim") {
      if (!dragKindRef.current) return;
      const sec = xToSec(e.clientX);
      const gap = 0.05;
      if (dragKindRef.current === "start") setStart(clamp(sec, 0, end - gap));
      else setEnd(clamp(sec, start + gap, duration));
      return;
    }

    const idx = dragIdxRef.current;
    if (idx === null) return;
    movedRef.current = true;
    clearLongPress();

    const np = toEnv(e.clientX, e.clientY);
    setPoints((prev) => {
      const next = prev.map((p) => ({ ...p }));
      const isFirst = idx === 0;
      const isLast = idx === next.length - 1;
      // 端点は時刻固定（0/1）、ゲインのみ可変
      next[idx].gain = np.gain;
      if (!isFirst && !isLast) {
        const lo = next[idx - 1].t + 0.001;
        const hi = next[idx + 1].t - 0.001;
        next[idx].t = clamp(np.t, lo, hi);
      }
      return next;
    });
  };

  const onPointerUp = () => {
    dragKindRef.current = null;
    dragIdxRef.current = null;
    clearLongPress();
  };

  const stopPreview = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    previewGainRef.current?.disconnect();
    previewGainRef.current = null;
    setPlaying(false);
  }, []);

  const playPreview = useCallback(() => {
    stopPreview();
    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;
    void ctx.resume();

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    src.connect(gain);
    gain.connect(ctx.destination);
    previewGainRef.current = gain;

    if (loop) {
      src.loop = true;
      src.loopStart = start;
      src.loopEnd = end;
      src.start(0, start);
    } else {
      const dur = Math.max(0.01, end - start);
      // 非ループ時はエンベロープもプレビューに反映
      const pts = [...points].sort((a, b) => a.t - b.t);
      if (pts.length >= 2 && pts.some((p) => Math.abs(p.gain - 1) > 0.001)) {
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(Math.max(0.0001, pts[0].gain), now);
        for (let i = 1; i < pts.length; i++) {
          gain.gain.linearRampToValueAtTime(Math.max(0.0001, pts[i].gain), now + pts[i].t * dur);
        }
      }
      src.start(0, start, dur);
      src.onended = () => {
        if (sourceRef.current === src) stopPreview();
      };
    }
    sourceRef.current = src;
    setPlaying(true);
  }, [buffer, start, end, loop, points, stopPreview]);

  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      sourceRef.current?.disconnect();
      sourceRef.current = null;
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
      clearLongPress();
    };
  }, [buffer]);

  const selectedDur = Math.max(0, end - start);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          variant={mode === "trim" ? "accent" : "secondary"}
          size="sm"
          className="flex-1"
          onClick={() => setMode("trim")}
        >
          <Scissors /> トリム
        </Button>
        <Button
          variant={mode === "env" ? "accent" : "secondary"}
          size="sm"
          className="flex-1"
          onClick={() => setMode("env")}
        >
          <SlidersHorizontal /> エンベロープ
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        className="h-28 w-full touch-none rounded-xl bg-background/40"
        role="img"
        aria-label={mode === "trim" ? "波形トリム編集領域" : "ゲインエンベロープ編集領域"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {mode === "trim" ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Scissors className="h-3.5 w-3.5" /> {formatTime(start)} – {formatTime(end)}
          </span>
          <span className="font-mono tabular-nums">選択 {formatTime(selectedDur)}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>タップで追加 / ドラッグで移動 / 中間点は長押しで削除</span>
          <button
            className="focus-ring flex items-center gap-1 rounded-md px-2 py-1 hover:bg-secondary"
            onClick={() => setPoints(FLAT)}
          >
            <RotateCcw className="h-3.5 w-3.5" /> リセット
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant={loop ? "accent" : "secondary"}
          size="sm"
          onClick={() => setLoop((v) => !v)}
          aria-pressed={loop}
        >
          <Repeat /> ループ{loop ? "ON" : "OFF"}
        </Button>
        {playing ? (
          <Button variant="destructive" size="sm" className="flex-1" onClick={stopPreview}>
            <Square /> 停止
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className="flex-1" onClick={playPreview}>
            <Play /> 選択範囲をプレビュー
          </Button>
        )}
      </div>
    </div>
  );
}
