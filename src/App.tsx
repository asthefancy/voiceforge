import { useCallback, useEffect, useState } from "react";
import { Moon, Sun, Radio, FileUp, Grid3x3 } from "lucide-react";
import type { EffectNodeConfig, Preset } from "@/types";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useTheme } from "@/hooks/useTheme";
import { useSoundboard } from "@/hooks/useSoundboard";
import { useToast } from "@/components/ui/toast";
import { presetStore } from "@/lib/storage";
import { readSharedPresetFromUrl } from "@/lib/share";
import { makeEffectConfig } from "@/lib/effects";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PrivacyDashboard } from "@/components/PrivacyDashboard";
import { Visualizer } from "@/components/Visualizer";
import { LevelMeter } from "@/components/LevelMeter";
import { PresetBar } from "@/components/PresetBar";
import { EffectChainEditor } from "@/components/EffectChainEditor";
import { RealtimePanel } from "@/components/RealtimePanel";
import { FileProcessor } from "@/components/FileProcessor";
import { Soundboard } from "@/components/Soundboard";
import { SaveClipDialog } from "@/components/SaveClipDialog";

export default function App() {
  const engine = useAudioEngine();
  const { theme, toggle } = useTheme();
  const toast = useToast();

  const [chain, setChain] = useState<EffectNodeConfig[]>([]);
  const [inputGainDb, setInputGainDb] = useState(0);
  const [outputGainDb, setOutputGainDb] = useState(0);
  const [userPresets, setUserPresets] = useState<Preset[]>(() => presetStore.all());

  const [micReady, setMicReady] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [tab, setTab] = useState("realtime");

  // 起動時: URL 共有プリセットがあれば取り込む
  useEffect(() => {
    const shared = readSharedPresetFromUrl();
    if (shared) {
      setChain(shared.chain);
      setInputGainDb(shared.inputGainDb);
      setOutputGainDb(shared.outputGainDb);
    }
  }, []);

  // チェーン変更をエンジンへ反映（構造差分はエンジン側で判定）
  useEffect(() => {
    engine.updateChain(chain);
  }, [engine, chain]);

  useEffect(() => {
    engine.setInputGainDb(inputGainDb);
  }, [engine, inputGainDb]);

  useEffect(() => {
    engine.setOutputGainDb(outputGainDb);
  }, [engine, outputGainDb]);

  const ensureMic = useCallback(async () => {
    if (micReady) return true;
    const ok = await engine.useMic();
    setMicReady(ok);
    if (!ok) toast("マイクへのアクセスが許可されませんでした。設定から権限を許可してください。", "error");
    return ok;
  }, [engine, micReady, toast]);

  // サウンドボードの状態と録音フロー（録音はリアルタイムから、表示はボードで連動）
  const sb = useSoundboard(engine, ensureMic, toast);

  const toggleMic = useCallback(async () => {
    if (micReady) {
      engine.setMonitoring(false);
      setMonitoring(false);
      // 入力ソースのみ解放（エンジン/エフェクトチェーンは保持して即再開可能に）
      engine.stopInput();
      setMicReady(false);
    } else {
      await ensureMic();
    }
  }, [engine, micReady, ensureMic]);

  const toggleMonitor = useCallback(
    (on: boolean) => {
      engine.setMonitoring(on);
      setMonitoring(on);
    },
    [engine],
  );

  const applyPreset = useCallback((preset: Preset) => {
    // id を振り直して取り込む（共有/内蔵プリセットの id 衝突を防ぐ）
    setChain(
      preset.chain.map((c, i) => ({
        ...c,
        id: `${c.kind}-${Date.now().toString(36)}-${i}`,
        params: { ...c.params },
      })),
    );
    setInputGainDb(preset.inputGainDb);
    setOutputGainDb(preset.outputGainDb);
  }, []);

  const savePreset = useCallback(
    (name: string) => {
      const preset: Preset = {
        id: `preset-${Date.now().toString(36)}`,
        name,
        inputGainDb,
        outputGainDb,
        chain: chain.map((c) => ({ ...c, params: { ...c.params } })),
      };
      setUserPresets(presetStore.upsert(preset));
    },
    [chain, inputGainDb, outputGainDb],
  );

  const applySuggestion = useCallback((pitchSemitones: number, formantHz: number) => {
    setChain((prev) => {
      const next = [...prev];
      const ps = next.find((c) => c.kind === "pitchShift") ?? addAndReturn(next, "pitchShift");
      ps.params = { ...ps.params, pitch: pitchSemitones };
      const fm = next.find((c) => c.kind === "formant") ?? addAndReturn(next, "formant");
      fm.params = { ...fm.params, frequency: Math.max(200, Math.min(3000, formantHz)) };
      return next.map((c) => ({ ...c }));
    });
  }, []);

  const visualActive = micReady || tab === "realtime";

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 glass">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
          <h1 className="text-lg font-bold gradient-text">VoiceForge</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="テーマ切替">
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-24 pt-4">
        <PrivacyDashboard />

        <Card className="flex gap-3 p-3">
          <Visualizer engine={engine} active={visualActive} className="h-24 flex-1 rounded-xl bg-background/40" />
          <LevelMeter engine={engine} active={micReady} />
        </Card>

        <PresetBar
          chain={chain}
          inputGainDb={inputGainDb}
          outputGainDb={outputGainDb}
          userPresets={userPresets}
          onApply={applyPreset}
          onSave={savePreset}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="realtime">
              <Radio className="h-4 w-4" /> リアルタイム
            </TabsTrigger>
            <TabsTrigger value="file">
              <FileUp className="h-4 w-4" /> ファイル
            </TabsTrigger>
            <TabsTrigger value="board">
              <Grid3x3 className="h-4 w-4" /> ボード
            </TabsTrigger>
          </TabsList>

          <TabsContent value="realtime" className="mt-4 focus-visible:outline-none">
            <RealtimePanel
              engine={engine}
              micReady={micReady}
              monitoring={monitoring}
              inputGainDb={inputGainDb}
              outputGainDb={outputGainDb}
              ensureMic={ensureMic}
              onToggleMic={toggleMic}
              onToggleMonitor={toggleMonitor}
              onInputGain={setInputGainDb}
              onOutputGain={setOutputGainDb}
              onApplySuggestion={applySuggestion}
              recording={sb.recording}
              onStartRecording={sb.startRecording}
              onStopRecording={sb.stopRecording}
            />
          </TabsContent>

          <TabsContent value="file" className="mt-4 focus-visible:outline-none">
            <FileProcessor chain={chain} inputGainDb={inputGainDb} outputGainDb={outputGainDb} />
          </TabsContent>

          <TabsContent value="board" className="mt-4 focus-visible:outline-none">
            <Soundboard clips={sb.clips} onRemove={sb.removeClip} />
          </TabsContent>
        </Tabs>

        <EffectChainEditor chain={chain} onChange={setChain} />
      </main>

      <SaveClipDialog pending={sb.pending} onClose={sb.discardPending} onSave={sb.savePending} />
    </div>
  );
}

/** チェーン配列へ新規エフェクトを追加し、その config を返す */
function addAndReturn(arr: EffectNodeConfig[], kind: EffectNodeConfig["kind"]): EffectNodeConfig {
  const cfg = makeEffectConfig(kind);
  arr.push(cfg);
  return cfg;
}
