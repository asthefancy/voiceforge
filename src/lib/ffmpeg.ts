import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * ffmpeg.wasm ラッパー。動画からの音声抽出と、変換後音声の再合成を行う。
 * 完全クライアントサイドで動作。core はシングルスレッド版を使い、
 * SharedArrayBuffer 非対応環境でも確実に動くようにしている。
 *
 * 完全オフライン配布したい場合は CORE_BASE を自己ホスト先（/ffmpeg など）に変更し、
 * @ffmpeg/core の dist を public/ffmpeg/ に同梱すること。
 */
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type ProgressCb = (ratio: number) => void;

export async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();
    if (onLog) ff.on("log", ({ message }) => onLog(message));
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    instance = ff;
    return ff;
  })();

  return loadPromise;
}

/** 動画ファイルから音声を WAV(Uint8Array) で抽出 */
export async function extractAudioFromVideo(
  file: File,
  onProgress?: ProgressCb,
): Promise<Uint8Array> {
  const ff = await getFFmpeg();
  const inName = "input_video";
  const outName = "extracted.wav";

  const handler = ({ progress }: { progress: number }) => onProgress?.(progress);
  if (onProgress) ff.on("progress", handler);

  try {
    await ff.writeFile(inName, await fetchFile(file));
    await ff.exec(["-i", inName, "-vn", "-ar", "44100", "-ac", "2", "-f", "wav", outName]);
    const data = (await ff.readFile(outName)) as Uint8Array;
    await safeDelete(ff, inName);
    await safeDelete(ff, outName);
    return data;
  } finally {
    if (onProgress) ff.off("progress", handler);
  }
}

/**
 * 元動画の映像トラックと、変換後の音声(WAV)を再合成して MP4 を返す。
 * 映像は再エンコードせずコピー（高速・無劣化）。
 */
export async function remuxVideoWithAudio(
  videoFile: File,
  processedWav: Uint8Array,
  onProgress?: ProgressCb,
): Promise<Blob> {
  const ff = await getFFmpeg();
  const vName = "src_video";
  const aName = "new_audio.wav";
  const outName = "output.mp4";

  const handler = ({ progress }: { progress: number }) => onProgress?.(progress);
  if (onProgress) ff.on("progress", handler);

  try {
    await ff.writeFile(vName, await fetchFile(videoFile));
    await ff.writeFile(aName, processedWav);
    await ff.exec([
      "-i", vName,
      "-i", aName,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-shortest",
      outName,
    ]);
    const data = (await ff.readFile(outName)) as Uint8Array;
    await safeDelete(ff, vName);
    await safeDelete(ff, aName);
    await safeDelete(ff, outName);
    // BlobPart として確実に扱えるよう新規 ArrayBuffer にコピー
    return new Blob([data.slice().buffer], { type: "video/mp4" });
  } finally {
    if (onProgress) ff.off("progress", handler);
  }
}

async function safeDelete(ff: FFmpeg, name: string): Promise<void> {
  try {
    await ff.deleteFile(name);
  } catch {
    /* 既に無ければ無視 */
  }
}
