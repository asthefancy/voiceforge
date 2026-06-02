/**
 * VoiceForge 全体で共有する型定義。
 * エフェクトは「種類(kind) + パラメータ(params) + 有効フラグ + 並び順」で表現し、
 * シリアライズ可能（プリセット保存・URL共有・Tone.Offline 再現）にしてある。
 */

export type EffectKind =
  | "pitchShift"
  | "formant"
  | "bitCrusher"
  | "distortion"
  | "reverb"
  | "chorus"
  | "delay"
  | "autoFilter";

/** 1パラメータの値。すべて number（boolean は 0/1 で表現せず enabled で扱う）。 */
export type EffectParams = Record<string, number>;

export interface EffectNodeConfig {
  /** チェーン内でユニークな ID（並べ替え・React key 用） */
  id: string;
  kind: EffectKind;
  enabled: boolean;
  params: EffectParams;
}

/** 1パラメータの UI 定義（スライダー範囲・単位など） */
export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  /** 対数的に効くパラメータ（周波数など）のヒント */
  log?: boolean;
}

/** エフェクト種類ごとのメタ情報 */
export interface EffectSpec {
  kind: EffectKind;
  label: string;
  description: string;
  /** lucide-react アイコン名（UI で参照） */
  icon: string;
  params: ParamSpec[];
}

export interface Preset {
  id: string;
  name: string;
  /** 入力ゲイン(dB)。共有プリセットでも音量を再現するため保持 */
  inputGainDb: number;
  outputGainDb: number;
  chain: EffectNodeConfig[];
}

/** サウンドボードに保存する1フレーズ（完全端末内・IndexedDB 永続化） */
export interface SoundClip {
  id: string;
  name: string;
  tags: string[];
  durationSec: number;
  createdAt: number;
  /** 録音データ本体。IndexedDB は Blob を直接保存できるため base64 化しない。 */
  blob?: Blob;
  /** 旧バージョン互換: base64 data URL（localStorage 時代のクリップ用フォールバック） */
  dataUrl?: string;
}

export type InputMode = "mic" | "audioFile" | "videoFile";

/**
 * ゲインエンベロープのキーポイント。
 * t: 選択範囲に対する正規化時刻 (0..1)、gain: 線形ゲイン (0..1)。
 * 点間は線形補間。既定はフラット（[{t:0,gain:1},{t:1,gain:1}]）= 無加工。
 */
export interface EnvelopePoint {
  t: number;
  gain: number;
}

export interface AnalysisResult {
  /** 推定基本周波数(Hz)。検出不能時は null */
  pitchHz: number | null;
  /** 推定第1フォルマント(Hz) の目安 */
  formantHz: number | null;
  /** おすすめ PitchShift 量(semitone)と formant 補正の提案 */
  suggestion: {
    pitchSemitones: number;
    formantShift: number;
    label: string;
  };
}
