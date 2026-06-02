import { describe, it, expect } from "vitest";
import { SPECS, EFFECT_KINDS, defaultParams, makeEffectConfig } from "@/lib/effects";

describe("effects レジストリ", () => {
  it("全 kind に SPEC が存在し、icon と params を持つ", () => {
    for (const kind of EFFECT_KINDS) {
      const spec = SPECS[kind];
      expect(spec.kind).toBe(kind);
      expect(spec.icon.length).toBeGreaterThan(0);
      expect(spec.params.length).toBeGreaterThan(0);
    }
  });

  it("defaultParams は SPEC の全パラメータを既定値で埋める", () => {
    for (const kind of EFFECT_KINDS) {
      const params = defaultParams(kind);
      for (const p of SPECS[kind].params) {
        expect(params[p.key]).toBe(p.default);
        expect(params[p.key]).toBeGreaterThanOrEqual(p.min);
        expect(params[p.key]).toBeLessThanOrEqual(p.max);
      }
    }
  });

  it("makeEffectConfig は有効・既定値・ユニークIDで生成する", () => {
    const a = makeEffectConfig("pitchShift");
    const b = makeEffectConfig("pitchShift");
    expect(a.enabled).toBe(true);
    expect(a.kind).toBe("pitchShift");
    expect(a.id).not.toBe(b.id);
    expect(a.params).toEqual(defaultParams("pitchShift"));
  });
});
