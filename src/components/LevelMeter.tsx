import { useEffect, useRef, useState } from "react";
import type { AudioEngine } from "@/lib/audioEngine";

/** 出力レベル(dB)を縦バーで表示。active 時のみ更新。 */
export function LevelMeter({ engine, active }: { engine: AudioEngine; active: boolean }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }
    const tick = () => {
      const db = engine.getLevelDb();
      // -60dB..0dB を 0..1 に正規化
      const norm = Math.max(0, Math.min(1, (db + 60) / 60));
      setLevel((prev) => prev * 0.6 + norm * 0.4);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engine, active]);

  return (
    <div className="flex h-full w-2 flex-col-reverse overflow-hidden rounded-full bg-secondary">
      <div
        className="w-full rounded-full bg-gradient-to-t from-accent via-primary to-destructive transition-[height] duration-75"
        style={{ height: `${Math.round(level * 100)}%` }}
      />
    </div>
  );
}
