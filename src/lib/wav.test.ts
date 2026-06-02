import { describe, it, expect } from "vitest";
import { audioBufferToWav, computePeaks } from "@/lib/wav";

/** テスト用の最小 AudioBuffer 互換オブジェクト（モノラル） */
function fakeBuffer(samples: Float32Array, sampleRate = 44100): AudioBuffer {
  return {
    numberOfChannels: 1,
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    getChannelData: (_ch: number) => samples,
  } as unknown as AudioBuffer;
}

function ascii(view: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

describe("audioBufferToWav", () => {
  it("正しい RIFF/WAVE ヘッダと長さを書き出す", async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const blob = audioBufferToWav(fakeBuffer(samples));
    const view = new DataView(await blob.arrayBuffer());

    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint16(34, true)).toBe(16); // 16bit
    // data サイズ = サンプル数 * 2byte
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
    // 全体サイズ = 44 + data - 8
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2);
  });

  it("クリッピング（±1超）は範囲内に収める", async () => {
    const blob = audioBufferToWav(fakeBuffer(new Float32Array([2, -2])));
    const view = new DataView(await blob.arrayBuffer());
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });
});

describe("computePeaks", () => {
  it("バケット数分の min/max を返し範囲は -1..1", () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 5);
    const { min, max } = computePeaks(fakeBuffer(samples), 100);
    expect(min).toHaveLength(100);
    expect(max).toHaveLength(100);
    for (let i = 0; i < 100; i++) {
      expect(max[i]).toBeGreaterThanOrEqual(min[i]);
      expect(max[i]).toBeLessThanOrEqual(1);
      expect(min[i]).toBeGreaterThanOrEqual(-1);
    }
  });
});
