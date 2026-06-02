/**
 * AudioBuffer を 16bit PCM WAV (Blob) へエンコードする。
 * 外部ライブラリ不要・完全クライアントサイド。
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF ヘッダ
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  // fmt チャンク
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  // data チャンク
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // チャンネルデータをインターリーブして 16bit へ量子化
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * AudioBuffer を [startSec, endSec) でトリムし、新しい AudioBuffer を返す。
 * 元バッファは変更しない。範囲が無効な場合は丸めて安全側に補正する。
 */
export function sliceAudioBuffer(buffer: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const sr = buffer.sampleRate;
  const start = Math.max(0, Math.min(buffer.length, Math.floor(startSec * sr)));
  const end = Math.max(start + 1, Math.min(buffer.length, Math.floor(endSec * sr)));
  const length = end - start;

  // OfflineAudioContext を使うと環境差なく AudioBuffer を生成できる
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, length, sr);
  const out = ctx.createBuffer(buffer.numberOfChannels, length, sr);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    out.copyToChannel(buffer.getChannelData(ch).subarray(start, end), ch);
  }
  return out;
}

/**
 * 波形描画用のピーク列を算出。各バケットの最小/最大を返す（-1..1）。
 */
export function computePeaks(buffer: AudioBuffer, buckets: number): { min: Float32Array; max: Float32Array } {
  const data = buffer.getChannelData(0);
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const size = Math.max(1, Math.floor(data.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let lo = 1;
    let hi = -1;
    const start = b * size;
    const end = Math.min(data.length, start + size);
    for (let i = start; i < end; i++) {
      const v = data[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min[b] = lo;
    max[b] = hi;
  }
  return { min, max };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
