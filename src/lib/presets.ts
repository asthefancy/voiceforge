import type { Preset } from "@/types";
import { defaultParams, makeEffectConfig } from "@/lib/effects";

/** 設定済みパラメータでエフェクト config を作るヘルパー */
function effect(kind: Parameters<typeof makeEffectConfig>[0], overrides: Record<string, number> = {}) {
  const cfg = makeEffectConfig(kind);
  cfg.params = { ...defaultParams(kind), ...overrides };
  return cfg;
}

/** 出荷時プリセット。ユーザーはこれを複製して自分用に編集できる。 */
export const BUILTIN_PRESETS: Preset[] = [
  {
    id: "builtin-chipmunk",
    name: "チップマンク",
    inputGainDb: 0,
    outputGainDb: 0,
    chain: [effect("pitchShift", { pitch: 8 }), effect("formant", { frequency: 1800, gain: 8 })],
  },
  {
    id: "builtin-deep",
    name: "重低音ヴィラン",
    inputGainDb: 0,
    outputGainDb: 1,
    chain: [
      effect("pitchShift", { pitch: -7 }),
      effect("formant", { frequency: 500, gain: 6 }),
      effect("reverb", { decay: 3, wet: 0.25 }),
    ],
  },
  {
    id: "builtin-robot",
    name: "ロボット",
    inputGainDb: 0,
    outputGainDb: 0,
    chain: [
      effect("bitCrusher", { bits: 6, wet: 0.7 }),
      effect("autoFilter", { frequency: 6, octaves: 2, wet: 0.5 }),
      effect("distortion", { distortion: 0.2, wet: 0.4 }),
    ],
  },
  {
    id: "builtin-monster",
    name: "モンスター",
    inputGainDb: 0,
    outputGainDb: 0,
    chain: [
      effect("pitchShift", { pitch: -12 }),
      effect("distortion", { distortion: 0.6, wet: 0.6 }),
      effect("reverb", { decay: 2, wet: 0.3 }),
    ],
  },
  {
    id: "builtin-hall",
    name: "大ホール",
    inputGainDb: 0,
    outputGainDb: 0,
    chain: [effect("reverb", { decay: 6, wet: 0.5 }), effect("chorus", { wet: 0.3 })],
  },
  {
    id: "builtin-telephone",
    name: "電話越し",
    inputGainDb: 0,
    outputGainDb: 0,
    chain: [
      effect("formant", { frequency: 1500, Q: 6, gain: 10 }),
      effect("bitCrusher", { bits: 10, wet: 0.3 }),
    ],
  },
];

export function clonePreset(p: Preset, name?: string): Preset {
  return {
    ...p,
    id: `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name ?? `${p.name} のコピー`,
    chain: p.chain.map((c) => ({ ...c, id: `${c.kind}-${Math.random().toString(36).slice(2, 9)}`, params: { ...c.params } })),
  };
}

export function emptyPreset(): Preset {
  return {
    id: `preset-${Date.now().toString(36)}`,
    name: "新しいプリセット",
    inputGainDb: 0,
    outputGainDb: 0,
    chain: [],
  };
}
