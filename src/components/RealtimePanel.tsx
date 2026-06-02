import { Mic, MicOff, Headphones, AlertTriangle } from "lucide-react";
import type { AudioEngine } from "@/lib/audioEngine";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { VoiceAnalyzer } from "@/components/VoiceAnalyzer";
import { LatencyControl } from "@/components/LatencyControl";

interface Props {
  engine: AudioEngine;
  micReady: boolean;
  monitoring: boolean;
  inputGainDb: number;
  outputGainDb: number;
  ensureMic: () => Promise<boolean>;
  onToggleMic: () => void;
  onToggleMonitor: (on: boolean) => void;
  onInputGain: (db: number) => void;
  onOutputGain: (db: number) => void;
  onApplySuggestion: (pitchSemitones: number, formantHz: number) => void;
}

export function RealtimePanel(props: Props) {
  const {
    engine,
    micReady,
    monitoring,
    inputGainDb,
    outputGainDb,
    ensureMic,
    onToggleMic,
    onToggleMonitor,
    onInputGain,
    onOutputGain,
    onApplySuggestion,
  } = props;

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <Button
          size="lg"
          variant={micReady ? "destructive" : "default"}
          className="w-full"
          onClick={onToggleMic}
        >
          {micReady ? <MicOff /> : <Mic />}
          {micReady ? "マイクを停止" : "マイクを開始"}
        </Button>

        <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3">
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium">スピーカー出力</p>
              <p className="text-[11px] text-muted-foreground">加工後の声をリアルタイム再生</p>
            </div>
          </div>
          <Switch checked={monitoring} onCheckedChange={onToggleMonitor} disabled={!micReady} />
        </div>

        {monitoring && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-[11px] text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ハウリング防止のためイヤホン/ヘッドホンの使用を推奨します。
          </div>
        )}

        <GainSlider label="入力ゲイン" value={inputGainDb} onChange={onInputGain} />
        <GainSlider label="出力ゲイン" value={outputGainDb} onChange={onOutputGain} />
      </Card>

      <LatencyControl engine={engine} />

      <VoiceAnalyzer engine={engine} ensureMic={ensureMic} onApply={onApplySuggestion} />
    </div>
  );
}

function GainSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (db: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">
          {value > 0 ? "+" : ""}
          {value.toFixed(1)} dB
        </span>
      </div>
      <Slider min={-24} max={24} step={0.5} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
