import * as Tone from "tone";
import type { EffectNodeConfig, EnvelopePoint } from "@/types";
import { applyParams, createToneEffect, type ToneEffect } from "@/lib/effects";

/**
 * VoiceForge のリアルタイム音声エンジン。
 *
 * 経路: 入力(マイク or プレイヤー) → inputGain → [エフェクトチェーン] → outputGain
 *        → fan(analyser, meter, Destination[, recorder])
 *
 * 設計上の要点:
 * - リアルタイムのスライダー操作では「構造（並び・有効・種類）」が変わらない限り
 *   ノードを作り直さず applyParams のみ行い、クリックノイズ/GC を避ける。
 * - 構造が変わった時だけ rebuildRouting でノードを破棄→再生成し、確実に dispose する。
 * - dispose() で全 Tone ノードを解放しメモリリークを防ぐ。
 */
export class AudioEngine {
  private inputGain: Tone.Gain;
  private outputGain: Tone.Gain;
  private analyser: Tone.Analyser;
  private meter: Tone.Meter;

  private input: Tone.UserMedia | Tone.Player | null = null;
  private effects = new Map<string, ToneEffect>();
  private recorder: Tone.Recorder | null = null;

  /** 直近に適用したチェーン構造のシグネチャ。差分判定に使う。 */
  private structureSig = "";
  private monitoring = false;

  constructor() {
    this.inputGain = new Tone.Gain(1);
    this.outputGain = new Tone.Gain(1);
    this.analyser = new Tone.Analyser("waveform", 1024);
    this.meter = new Tone.Meter({ smoothing: 0.8 });

    // 出力は常に解析用ノードへ分岐。Destination への接続は monitoring 切替で管理。
    this.outputGain.connect(this.analyser);
    this.outputGain.connect(this.meter);

    // 初期は空チェーン（inputGain → outputGain 直結）
    this.inputGain.connect(this.outputGain);
  }

  /** AudioContext を起動（必ずユーザー操作内で呼ぶ） */
  static async start(): Promise<void> {
    await Tone.start();
  }

  get context(): Tone.BaseContext {
    return Tone.getContext();
  }

  /** マイク入力へ切替。成功で true。権限拒否などで false。 */
  async useMic(): Promise<boolean> {
    await AudioEngine.start();
    this.disposeInput();
    const mic = new Tone.UserMedia();
    try {
      await mic.open();
    } catch {
      mic.dispose();
      return false;
    }
    this.input = mic;
    mic.connect(this.inputGain);
    return true;
  }

  /** ファイル由来の AudioBuffer をプレイヤー入力に設定 */
  async usePlayer(buffer: AudioBuffer): Promise<Tone.Player> {
    await AudioEngine.start();
    this.disposeInput();
    const player = new Tone.Player(buffer);
    player.connect(this.inputGain);
    this.input = player;
    return player;
  }

  get player(): Tone.Player | null {
    return this.input instanceof Tone.Player ? this.input : null;
  }

  /** スピーカー出力（モニタリング）の ON/OFF。ハウリング防止のため明示制御。 */
  setMonitoring(on: boolean): void {
    if (on === this.monitoring) return;
    if (on) this.outputGain.connect(Tone.getDestination());
    else this.outputGain.disconnect(Tone.getDestination());
    this.monitoring = on;
  }

  setInputGainDb(db: number): void {
    this.inputGain.gain.rampTo(Tone.dbToGain(db), 0.05);
  }

  setOutputGainDb(db: number): void {
    this.outputGain.gain.rampTo(Tone.dbToGain(db), 0.05);
  }

  /**
   * チェーン設定を反映。構造が同じならパラメータのみ更新（軽量）。
   * 構造が変わったらノードを作り直す。
   */
  updateChain(configs: EffectNodeConfig[]): void {
    const enabled = configs.filter((c) => c.enabled);
    const sig = enabled.map((c) => `${c.id}:${c.kind}`).join("|");

    if (sig === this.structureSig) {
      for (const c of enabled) {
        const node = this.effects.get(c.id);
        if (node) applyParams(node, c.kind, c.params);
      }
      return;
    }
    this.rebuildRouting(enabled);
    this.structureSig = sig;
  }

  private rebuildRouting(enabled: EffectNodeConfig[]): void {
    // 既存配線を解除して破棄
    this.inputGain.disconnect();
    for (const node of this.effects.values()) node.dispose();
    this.effects.clear();

    const nodes: ToneEffect[] = enabled.map((c) => {
      const node = createToneEffect(c.kind);
      applyParams(node, c.kind, c.params);
      this.effects.set(c.id, node);
      return node;
    });

    if (nodes.length > 0) {
      this.inputGain.chain(...nodes, this.outputGain);
    } else {
      this.inputGain.connect(this.outputGain);
    }
  }

  /** 解析用：波形データ（-1..1） */
  getWaveform(): Float32Array {
    return this.analyser.getValue() as Float32Array;
  }

  /** 解析用：出力レベル(dB)。ステレオ時は最大値。 */
  getLevelDb(): number {
    const v = this.meter.getValue();
    return Array.isArray(v) ? Math.max(...v) : v;
  }

  // ---- リアルタイム録音（出力をそのままキャプチャ） ----
  async startRecording(): Promise<void> {
    if (this.recorder) return;
    this.recorder = new Tone.Recorder();
    this.outputGain.connect(this.recorder);
    await this.recorder.start();
  }

  /** 録音停止し Blob を返す（webm/ogg）。録音していなければ null。 */
  async stopRecording(): Promise<Blob | null> {
    if (!this.recorder) return null;
    const blob = await this.recorder.stop();
    this.outputGain.disconnect(this.recorder);
    this.recorder.dispose();
    this.recorder = null;
    return blob;
  }

  /** 入力ソースだけを停止・解放（エンジン本体は再利用可能なまま残す） */
  stopInput(): void {
    this.disposeInput();
  }

  private disposeInput(): void {
    if (this.input instanceof Tone.UserMedia) {
      this.input.close();
    }
    this.input?.dispose();
    this.input = null;
  }

  /** すべてのノードを解放（コンポーネント unmount 時に必ず呼ぶ） */
  dispose(): void {
    this.setMonitoring(false);
    this.disposeInput();
    for (const node of this.effects.values()) node.dispose();
    this.effects.clear();
    if (this.recorder) {
      this.recorder.dispose();
      this.recorder = null;
    }
    this.inputGain.dispose();
    this.outputGain.dispose();
    this.analyser.dispose();
    this.meter.dispose();
  }
}

/**
 * オフライン処理（ファイルモード）。
 * 入力 AudioBuffer をチェーンへ通し、レンダリング済み AudioBuffer を返す。
 * リアルタイム経路と同じ effects 定義を再利用するため音は一致する。
 */
export async function renderOffline(
  buffer: AudioBuffer,
  chain: EffectNodeConfig[],
  inputGainDb: number,
  outputGainDb: number,
  envelope?: EnvelopePoint[],
): Promise<AudioBuffer> {
  const enabled = chain.filter((c) => c.enabled);
  // リバーブ等のテール分だけ尾を伸ばす（最大の decay+preDelay を加味）
  let tail = 0;
  for (const c of enabled) {
    if (c.kind === "reverb") tail = Math.max(tail, (c.params.decay ?? 0) + (c.params.preDelay ?? 0));
    if (c.kind === "delay") tail = Math.max(tail, (c.params.delayTime ?? 0) * 4);
  }
  const duration = buffer.duration + tail + 0.1;

  // 実効的なエンベロープ（点が2未満、または全点 gain≈1 のフラットなら無加工扱い）
  const hasEnvelope =
    !!envelope && envelope.length >= 2 && envelope.some((p) => Math.abs(p.gain - 1) > 0.001);

  const rendered = await Tone.Offline(() => {
    const inGain = new Tone.Gain(Tone.dbToGain(inputGainDb));
    const outGain = new Tone.Gain(Tone.dbToGain(outputGainDb));
    // エンベロープ用ゲイン（キーポイント調整）。既定は 1 で無加工。
    const envGain = new Tone.Gain(1);
    const player = new Tone.Player(buffer);

    const nodes = enabled.map((c) => {
      const node = createToneEffect(c.kind);
      applyParams(node, c.kind, c.params);
      return node;
    });

    player.connect(inGain);
    if (nodes.length > 0) inGain.chain(...nodes, envGain);
    else inGain.connect(envGain);
    envGain.connect(outGain);
    outGain.toDestination();

    if (hasEnvelope && envelope) {
      const pts = [...envelope].sort((a, b) => a.t - b.t);
      // 元音の尺(buffer.duration)に対して時刻をマップ。tail 区間は最終ゲインを維持。
      envGain.gain.setValueAtTime(Math.max(0, pts[0].gain), 0);
      for (let i = 1; i < pts.length; i++) {
        const time = Math.min(buffer.duration, Math.max(0, pts[i].t) * buffer.duration);
        envGain.gain.linearRampToValueAtTime(Math.max(0, pts[i].gain), time);
      }
    }

    player.start(0);
  }, duration, buffer.numberOfChannels, buffer.sampleRate);

  return rendered.get() as AudioBuffer;
}
