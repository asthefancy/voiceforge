import type { AnalysisResult } from "@/types";

/**
 * 声質分析。AudioBuffer から基本周波数(F0)を自己相関で推定し、
 * フォルマント帯域の目安とおすすめ設定を提案する。
 * 完全クライアントサイド・軽量実装。
 */

/**
 * 自己相関（ACF）による基本周波数推定。
 * 「最初のゼロ交差より後の最大ピーク」を採用することで、オクターブ下げ
 * （倍周期）への誤検出を避ける。正規化に (SIZE-lag) を使わないのも同じ理由。
 */
function detectPitch(data: Float32Array, sampleRate: number): number | null {
  const SIZE = data.length;
  // 音量が小さすぎる区間は無効
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += data[i] * data[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  // 探索する周期範囲: 80Hz〜400Hz（人の声の概ねの範囲）
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.min(SIZE - 1, Math.floor(sampleRate / 80));

  // 生の自己相関（lag ごとの内積）。長さで割らないことで短ラグを過小評価しない。
  const acf = new Float32Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE - lag; i++) sum += data[i] * data[i + lag];
    acf[lag] = sum;
  }

  // 最初に ACF が 0 を下回る位置（基音の半周期付近）まで進める
  let d = 0;
  while (d < maxLag && acf[d] > 0) d++;

  // それ以降で最大ピークを探す
  let bestLag = -1;
  let best = 0;
  for (let lag = Math.max(d, minLag); lag <= maxLag; lag++) {
    if (acf[lag] > best) {
      best = acf[lag];
      bestLag = lag;
    }
  }

  // 信頼度: ラグ0（=全パワー）に対して十分な相関があるか
  if (bestLag <= 0 || best < acf[0] * 0.3) return null;
  return sampleRate / bestLag;
}

/** AudioBuffer 中央付近の代表フレームで分析 */
export function analyzeBuffer(buffer: AudioBuffer): AnalysisResult {
  const ch = buffer.getChannelData(0);
  const frameSize = Math.min(4096, ch.length);
  const start = Math.max(0, Math.floor(ch.length / 2) - frameSize / 2);
  const frame = ch.subarray(start, start + frameSize);

  const pitchHz = detectPitch(frame, buffer.sampleRate);

  // フォルマント目安: 男声 ~ 第1フォルマント低め、女声 ~ 高め。F0 から大まかに推定。
  let formantHz: number | null = null;
  if (pitchHz) formantHz = Math.round(pitchHz * 5.2);

  return { pitchHz, formantHz, suggestion: suggest(pitchHz) };
}

/** リアルタイムマイク用：波形フレームから直接 F0 推定 */
export function analyzeFrame(frame: Float32Array, sampleRate: number): AnalysisResult {
  const pitchHz = detectPitch(frame, sampleRate);
  const formantHz = pitchHz ? Math.round(pitchHz * 5.2) : null;
  return { pitchHz, formantHz, suggestion: suggest(pitchHz) };
}

function suggest(pitchHz: number | null): AnalysisResult["suggestion"] {
  if (!pitchHz) {
    return { pitchSemitones: 0, formantShift: 0, label: "声を検出できませんでした" };
  }
  // 男声寄り(<=160Hz) → 女声化提案 / 女声寄り(>=200Hz) → 男声化提案
  if (pitchHz <= 160) {
    return { pitchSemitones: 5, formantShift: 600, label: "男声 → 女声化のおすすめ設定" };
  }
  if (pitchHz >= 200) {
    return { pitchSemitones: -5, formantShift: -400, label: "女声 → 男声化のおすすめ設定" };
  }
  return { pitchSemitones: 0, formantShift: 0, label: "中性的な声。お好みで調整を" };
}
