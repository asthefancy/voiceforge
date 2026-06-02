import { describe, it, expect } from "vitest";
import { analyzeFrame } from "@/lib/analysis";

function sine(freq: number, sampleRate: number, length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = 0.8 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

describe("analyzeFrame (F0 推定)", () => {
  const sr = 44100;

  it("220Hz の正弦波を概ね検出する", () => {
    const res = analyzeFrame(sine(220, sr, 4096), sr);
    expect(res.pitchHz).not.toBeNull();
    expect(Math.abs(res.pitchHz! - 220)).toBeLessThan(15);
  });

  it("低い声(120Hz)には女声化を提案する", () => {
    const res = analyzeFrame(sine(120, sr, 4096), sr);
    expect(res.suggestion.pitchSemitones).toBeGreaterThan(0);
  });

  it("無音では検出不能(null)", () => {
    const res = analyzeFrame(new Float32Array(4096), sr);
    expect(res.pitchHz).toBeNull();
  });
});
