import * as Tone from "tone";
import type { EffectKind, EffectNodeConfig, EffectParams, EffectSpec } from "@/types";

/**
 * エフェクト定義レジストリ。
 * - SPECS: UI（スライダー範囲・ラベル）とデフォルト値の単一の真実。
 * - createToneEffect: kind から実際の Tone ノードを生成。
 * - applyParams: 設定値を Tone ノードへ反映（リアルタイム/オフライン共通）。
 *
 * 「formant」は Tone に専用ノードが無いため peaking フィルタで近似し、
 * フォルマント帯域を強調/移動することで声質変化を表現する。
 */

export const SPECS: Record<EffectKind, EffectSpec> = {
  pitchShift: {
    kind: "pitchShift",
    label: "ピッチシフト",
    description: "声の高さを半音単位で変える",
    icon: "ArrowUpDown",
    params: [
      { key: "pitch", label: "ピッチ", min: -24, max: 24, step: 1, default: 0, unit: "半音" },
      { key: "windowSize", label: "粒度", min: 0.03, max: 0.1, step: 0.005, default: 0.1, unit: "s" },
      { key: "feedback", label: "フィードバック", min: 0, max: 0.9, step: 0.01, default: 0 },
      { key: "wet", label: "ミックス", min: 0, max: 1, step: 0.01, default: 1 },
    ],
  },
  formant: {
    kind: "formant",
    label: "フォルマント",
    description: "声色（共鳴）を変えて性別感を調整",
    icon: "Waves",
    params: [
      { key: "frequency", label: "中心周波数", min: 200, max: 3000, step: 10, default: 1000, unit: "Hz", log: true },
      { key: "Q", label: "鋭さ", min: 0.5, max: 12, step: 0.1, default: 3 },
      { key: "gain", label: "強調", min: -12, max: 18, step: 0.5, default: 6, unit: "dB" },
    ],
  },
  bitCrusher: {
    kind: "bitCrusher",
    label: "ビットクラッシャー",
    description: "ローファイ・ロボット感を付与",
    icon: "Binary",
    params: [
      { key: "bits", label: "ビット深度", min: 1, max: 16, step: 1, default: 8 },
      { key: "wet", label: "ミックス", min: 0, max: 1, step: 0.01, default: 0.6 },
    ],
  },
  distortion: {
    kind: "distortion",
    label: "ディストーション",
    description: "歪みで攻撃的・モンスター声に",
    icon: "Flame",
    params: [
      { key: "distortion", label: "歪み量", min: 0, max: 1, step: 0.01, default: 0.4 },
      { key: "wet", label: "ミックス", min: 0, max: 1, step: 0.01, default: 0.7 },
    ],
  },
  reverb: {
    kind: "reverb",
    label: "リバーブ",
    description: "空間の響きを付与",
    icon: "Mountain",
    params: [
      { key: "decay", label: "減衰", min: 0.1, max: 10, step: 0.1, default: 2.5, unit: "s" },
      { key: "preDelay", label: "プリディレイ", min: 0, max: 0.1, step: 0.005, default: 0.01, unit: "s" },
      { key: "wet", label: "ミックス", min: 0, max: 1, step: 0.01, default: 0.4 },
    ],
  },
  chorus: {
    kind: "chorus",
    label: "コーラス",
    description: "厚み・揺らぎのある合唱感",
    icon: "Layers",
    params: [
      { key: "frequency", label: "レート", min: 0.1, max: 10, step: 0.1, default: 1.5, unit: "Hz" },
      { key: "delayTime", label: "ディレイ", min: 1, max: 20, step: 0.5, default: 3.5, unit: "ms" },
      { key: "depth", label: "深さ", min: 0, max: 1, step: 0.01, default: 0.7 },
      { key: "wet", label: "ミックス", min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  delay: {
    kind: "delay",
    label: "ディレイ",
    description: "やまびこ・リズミカルな反復",
    icon: "Repeat",
    params: [
      { key: "delayTime", label: "タイム", min: 0, max: 1, step: 0.01, default: 0.25, unit: "s" },
      { key: "feedback", label: "フィードバック", min: 0, max: 0.9, step: 0.01, default: 0.35 },
      { key: "wet", label: "ミックス", min: 0, max: 1, step: 0.01, default: 0.4 },
    ],
  },
  autoFilter: {
    kind: "autoFilter",
    label: "オートフィルター",
    description: "周期的に音色が動くワブル感",
    icon: "Activity",
    params: [
      { key: "frequency", label: "LFOレート", min: 0.1, max: 10, step: 0.1, default: 1, unit: "Hz" },
      { key: "baseFrequency", label: "基準周波数", min: 100, max: 2000, step: 10, default: 200, unit: "Hz", log: true },
      { key: "octaves", label: "可動域", min: 1, max: 6, step: 0.5, default: 3, unit: "oct" },
      { key: "wet", label: "ミックス", min: 0, max: 1, step: 0.01, default: 0.6 },
    ],
  },
};

export const EFFECT_KINDS = Object.keys(SPECS) as EffectKind[];

/** kind のデフォルトパラメータを生成 */
export function defaultParams(kind: EffectKind): EffectParams {
  const p: EffectParams = {};
  for (const spec of SPECS[kind].params) p[spec.key] = spec.default;
  return p;
}

let idCounter = 0;
export function makeEffectConfig(kind: EffectKind): EffectNodeConfig {
  idCounter += 1;
  return {
    id: `${kind}-${Date.now().toString(36)}-${idCounter}`,
    kind,
    enabled: true,
    params: defaultParams(kind),
  };
}

/** Tone のエフェクト系ノードに共通する型（接続・破棄用）。 */
export type ToneEffect = Tone.ToneAudioNode;

/** kind から Tone ノードを生成。生成直後に applyParams で値を流し込む想定。 */
export function createToneEffect(kind: EffectKind): ToneEffect {
  switch (kind) {
    case "pitchShift":
      return new Tone.PitchShift();
    case "formant":
      return new Tone.Filter({ type: "peaking" });
    case "bitCrusher":
      return new Tone.BitCrusher();
    case "distortion":
      return new Tone.Distortion();
    case "reverb":
      return new Tone.Reverb();
    case "chorus": {
      const c = new Tone.Chorus();
      c.start();
      return c;
    }
    case "delay":
      return new Tone.FeedbackDelay();
    case "autoFilter": {
      const f = new Tone.AutoFilter();
      f.start();
      return f;
    }
    default: {
      // 網羅性チェック
      const _exhaustive: never = kind;
      throw new Error(`unknown effect kind: ${_exhaustive as string}`);
    }
  }
}

/**
 * 設定値を Tone ノードへ反映。リアルタイム編集ではこれを都度呼ぶ。
 * AudioParam は rampTo で軽くスムージングしクリックノイズを防ぐ。
 */
export function applyParams(node: ToneEffect, kind: EffectKind, params: EffectParams): void {
  // Tone の Param / Signal は共通して rampTo を持つ。型差異を吸収する最小インターフェース。
  const ramp = (param: { rampTo: (value: number, time: number) => unknown }, value: number) => {
    param.rampTo(value, 0.03);
  };

  switch (kind) {
    case "pitchShift": {
      const n = node as unknown as Tone.PitchShift;
      n.pitch = params.pitch;
      n.windowSize = params.windowSize;
      ramp(n.feedback, params.feedback);
      ramp(n.wet, params.wet);
      break;
    }
    case "formant": {
      const n = node as unknown as Tone.Filter;
      ramp(n.frequency, params.frequency);
      ramp(n.Q, params.Q);
      ramp(n.gain, params.gain);
      break;
    }
    case "bitCrusher": {
      const n = node as unknown as Tone.BitCrusher;
      n.bits.value = Math.round(params.bits);
      ramp(n.wet, params.wet);
      break;
    }
    case "distortion": {
      const n = node as unknown as Tone.Distortion;
      n.distortion = params.distortion;
      ramp(n.wet, params.wet);
      break;
    }
    case "reverb": {
      const n = node as unknown as Tone.Reverb;
      n.decay = params.decay;
      n.preDelay = params.preDelay;
      ramp(n.wet, params.wet);
      break;
    }
    case "chorus": {
      const n = node as unknown as Tone.Chorus;
      ramp(n.frequency, params.frequency);
      n.delayTime = params.delayTime;
      n.depth = params.depth;
      ramp(n.wet, params.wet);
      break;
    }
    case "delay": {
      const n = node as unknown as Tone.FeedbackDelay;
      ramp(n.delayTime, params.delayTime);
      ramp(n.feedback, params.feedback);
      ramp(n.wet, params.wet);
      break;
    }
    case "autoFilter": {
      const n = node as unknown as Tone.AutoFilter;
      ramp(n.frequency, params.frequency);
      n.baseFrequency = params.baseFrequency;
      n.octaves = params.octaves;
      ramp(n.wet, params.wet);
      break;
    }
  }
}
