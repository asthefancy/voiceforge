// PWA アイコン生成: public/favicon.svg をラスタライズして PNG を書き出す。
// 実行: node scripts/gen-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = await readFile(path.join(root, "public", "favicon.svg"));

const targets = [
  { name: "pwa-192x192.png", size: 192 },
  { name: "pwa-512x512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 11, g: 11, b: 18, alpha: 1 } })
    .png()
    .toFile(path.join(root, "public", name));
  console.log(`generated public/${name} (${size}x${size})`);
}
