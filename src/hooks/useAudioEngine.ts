import { useEffect, useRef } from "react";
import { AudioEngine } from "@/lib/audioEngine";

/**
 * AudioEngine のライフサイクルを React に束ねる。
 * インスタンスはマウント中ずっと同一で、unmount 時に必ず dispose する。
 */
export function useAudioEngine(): AudioEngine {
  const ref = useRef<AudioEngine | null>(null);
  if (ref.current === null) ref.current = new AudioEngine();

  useEffect(() => {
    const engine = ref.current;
    return () => {
      engine?.dispose();
      ref.current = null;
    };
  }, []);

  return ref.current;
}
