import { describe, it, expect } from "vitest";
import { encodePreset, decodePreset } from "@/lib/share";
import type { Preset } from "@/types";

const sample: Preset = {
  id: "x",
  name: "テスト声 🎙️",
  inputGainDb: -3,
  outputGainDb: 2.5,
  chain: [
    { id: "a", kind: "pitchShift", enabled: true, params: { pitch: 7, windowSize: 0.1, feedback: 0, wet: 1 } },
    { id: "b", kind: "reverb", enabled: false, params: { decay: 3, preDelay: 0.01, wet: 0.4 } },
  ],
};

describe("preset share encode/decode", () => {
  it("マルチバイト名を含めてラウンドトリップできる", () => {
    const decoded = decodePreset(encodePreset(sample));
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe(sample.name);
    expect(decoded!.inputGainDb).toBe(-3);
    expect(decoded!.outputGainDb).toBe(2.5);
  });

  it("チェーンの種類・有効・パラメータを保持する", () => {
    const decoded = decodePreset(encodePreset(sample))!;
    expect(decoded.chain).toHaveLength(2);
    expect(decoded.chain[0].kind).toBe("pitchShift");
    expect(decoded.chain[0].enabled).toBe(true);
    expect(decoded.chain[0].params.pitch).toBe(7);
    expect(decoded.chain[1].kind).toBe("reverb");
    expect(decoded.chain[1].enabled).toBe(false);
  });

  it("不正な文字列は null を返す", () => {
    expect(decodePreset("not-valid-base64!!")).toBeNull();
  });
});
