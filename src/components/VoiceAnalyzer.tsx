import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import type { AnalysisResult } from "@/types";
import type { AudioEngine } from "@/lib/audioEngine";
import { analyzeFrame } from "@/lib/analysis";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  engine: AudioEngine;
  ensureMic: () => Promise<boolean>;
  /** 提案を現在のチェーンへ反映 */
  onApply: (pitchSemitones: number, formantHz: number) => void;
}

/**
 * 声質分析ツール（差別化機能）。
 * マイクから数フレーム取得して F0 を推定し、性別変換のおすすめ設定を提案。
 */
export function VoiceAnalyzer({ engine, ensureMic, onApply }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const analyze = async () => {
    const ok = await ensureMic();
    if (!ok) return;
    setAnalyzing(true);

    // 複数フレームの中央値的な安定化のため数回サンプリング
    const sampleRate = engine.context.sampleRate;
    const samples: number[] = [];
    let last: AnalysisResult | null = null;

    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 120));
      const frame = engine.getWaveform();
      const res = analyzeFrame(frame, sampleRate);
      if (res.pitchHz) samples.push(res.pitchHz);
      last = res;
    }

    if (samples.length > 0) {
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)];
      last = analyzeFrame(engine.getWaveform(), sampleRate);
      setResult({ ...last, pitchHz: Math.round(median), formantHz: Math.round(median * 5.2), suggestion: last.suggestion });
    } else {
      setResult(last);
    }
    setAnalyzing(false);
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <p className="text-sm font-semibold">声質分析</p>
      </div>
      <p className="text-xs text-muted-foreground">
        マイクに向かって「あー」と声を出しながら分析すると、ピッチとフォルマントを推定し最適な設定を提案します。
      </p>

      <Button variant="secondary" className="w-full" onClick={analyze} disabled={analyzing}>
        {analyzing ? "分析中…" : "声を分析する"}
      </Button>

      {result && (
        <div className="space-y-3 rounded-xl bg-secondary/40 p-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            <Stat label="基本周波数 (F0)" value={result.pitchHz ? `${result.pitchHz} Hz` : "—"} />
            <Stat label="フォルマント目安" value={result.formantHz ? `${result.formantHz} Hz` : "—"} />
          </div>
          <p className="text-xs text-muted-foreground">{result.suggestion.label}</p>
          {result.pitchHz && result.suggestion.pitchSemitones !== 0 && (
            <Button
              variant="accent"
              className="w-full"
              onClick={() =>
                onApply(
                  result.suggestion.pitchSemitones,
                  (result.formantHz ?? 1000) + result.suggestion.formantShift,
                )
              }
            >
              <Wand2 /> この提案を適用（{result.suggestion.pitchSemitones > 0 ? "+" : ""}
              {result.suggestion.pitchSemitones}半音）
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
