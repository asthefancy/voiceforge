import { useEffect, useRef } from "react";
import type { AudioEngine } from "@/lib/audioEngine";

interface Props {
  engine: AudioEngine;
  active: boolean;
  className?: string;
}

/**
 * Canvas 波形ビジュアライザー。requestAnimationFrame で engine から
 * 波形を読み、滑らかに描画する。active=false の間はループを止める。
 */
export function Visualizer({ engine, active, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      canvas.width = clientWidth * dpr;
      canvas.height = clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const data = engine.getWaveform();
      const mid = h / 2;

      // グラデーション線
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#8b5cf6");
      grad.addColorStop(1, "#22d3ee");
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = grad;
      ctx.beginPath();

      const step = w / data.length;
      for (let i = 0; i < data.length; i++) {
        const x = i * step;
        const y = mid + data[i] * mid * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 中央線
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    if (active) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      // 非アクティブ時は静的な平坦線を一度だけ描画
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [engine, active]);

  return <canvas ref={canvasRef} className={className} />;
}
