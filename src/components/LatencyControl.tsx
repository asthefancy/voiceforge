import { useCallback, useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import type { AudioEngine } from "@/lib/audioEngine";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  engine: AudioEngine;
}

const PRESETS = [
  { label: "低遅延", lookAhead: 0.01, hint: "最小遅延 / 端末性能が必要" },
  { label: "バランス", lookAhead: 0.05, hint: "おすすめ" },
  { label: "安定", lookAhead: 0.1, hint: "途切れにくい" },
] as const;

/**
 * リアルタイムのレイテンシ計測＆調整 UI（差別化機能）。
 * Tone の lookAhead を切り替え、AudioContext の base/output レイテンシを実測表示する。
 */
export function LatencyControl({ engine }: Props) {
  const [selected, setSelected] = useState(0.05);
  const [info, setInfo] = useState({ lookAhead: 0, base: 0, output: 0 });

  const refresh = useCallback(() => setInfo(engine.getLatencyMs()), [engine]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const apply = (lookAhead: number) => {
    engine.setLookAhead(lookAhead);
    setSelected(lookAhead);
    refresh();
  };

  const total = Math.round(info.lookAhead + info.base + info.output);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-accent" />
          <p className="text-sm font-semibold">レイテンシ</p>
        </div>
        <span className="font-mono text-sm tabular-nums">
          約 {total} ms
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => apply(p.lookAhead)}
            className={cn(
              "rounded-xl border p-2 text-center transition-colors",
              selected === p.lookAhead
                ? "border-accent bg-accent/15"
                : "border-border bg-secondary/40 hover:bg-secondary",
            )}
          >
            <p className="text-sm font-medium">{p.label}</p>
            <p className="text-[10px] text-muted-foreground">{p.hint}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
        <Metric label="lookAhead" value={info.lookAhead} />
        <Metric label="base" value={info.base} />
        <Metric label="output" value={info.output} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        端末で途切れ・ノイズが出る場合は「安定」へ。十分な性能なら「低遅延」で会話のズレを抑えられます。
      </p>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-secondary/40 py-1.5">
      <p>{label}</p>
      <p className="font-mono tabular-nums text-foreground">{value.toFixed(1)}ms</p>
    </div>
  );
}
