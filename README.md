# VoiceForge 🎙️

**完全クライアントサイド**で動作する、スマホ向け本格ボイスチェンジャー。
録音・変換・保存のすべてが端末内で完結し、サーバー・API・課金は一切ありません。

iOS / Android（Capacitor）+ PWA に同時対応。

---

## ✨ 主な機能

| 機能 | 内容 |
| --- | --- |
| 入力 3 種 | リアルタイムマイク / 音声ファイル / 動画ファイル（音声自動抽出） |
| リアルタイム変換 | マイク → エフェクト → スピーカー出力（低遅延・モニタリング切替） |
| ファイル処理 | `Tone.Offline` でオフライン変換 → WAV / MP4 書き出し |
| 動画完全統合 | 音声抽出 → 変換 → 元動画へ再合成（ffmpeg.wasm, 映像は無劣化コピー） |
| エフェクトチェーン | ドラッグ&ドロップで並べ替え・ON/OFF・パラメータ調整 |
| プリセット | 内蔵プリセット + 自作保存 + **URL 共有**（設定は URL 内、送信ゼロ） |
| サウンドボード | 加工後の声を録音 → タグ付き保存 → 検索 → ワンクリック再生 |
| 波形エディタ | トリム / ループプレビュー / ゲインエンベロープ（キーポイント調整） |
| レイテンシ調整 | `lookAhead` を低遅延/バランス/安定で切替 + base/output を実測表示 |
| クリップ共有 | サウンドボードのクリップを Web Share API で共有 / ファイル保存 |
| 声質分析 | F0（基本周波数）推定 → 性別変換のおすすめ設定を自動提案 |
| プライバシー | 「すべて端末内で処理」を常時可視化するダッシュボード |
| UX | モバイルファースト / ダークモード / Canvas 波形 / PWA インストール |

エフェクト: PitchShift・Formant（peaking filter 近似）・BitCrusher・Distortion・Reverb・Chorus・Delay・AutoFilter

---

## 🗂 フォルダ構成

```
VoiceForge/
├─ index.html
├─ package.json
├─ vite.config.ts            # PWA / COOP・COEP（ffmpeg.wasm 用）/ alias
├─ capacitor.config.ts       # ネイティブ設定（SplashScreen / StatusBar）
├─ tailwind.config.ts        # shadcn テーマ（CSS 変数）
├─ tsconfig*.json
├─ public/
│   ├─ favicon.svg
│   └─ robots.txt
└─ src/
    ├─ main.tsx              # エントリ（StrictMode 不使用＝オーディオ安定化）
    ├─ App.tsx               # 画面統合・状態オーケストレーション
    ├─ index.css            # Tailwind + テーマ変数 + セーフエリア
    ├─ types.ts
    ├─ lib/
    │   ├─ audioEngine.ts    # ★リアルタイム経路 + renderOffline（心臓部）
    │   ├─ effects.ts        # エフェクト定義レジストリ + Tone ノード生成/適用
    │   ├─ presets.ts        # 内蔵プリセット
    │   ├─ wav.ts            # AudioBuffer → 16bit WAV エンコーダ
    │   ├─ ffmpeg.ts         # 動画 音声抽出 / 再合成
    │   ├─ analysis.ts       # 自己相関による F0 推定
    │   ├─ share.ts          # プリセット URL エンコード/デコード
    │   ├─ storage.ts        # localStorage（クリップ/プリセット）
    │   ├─ native.ts         # Capacitor 連携（保存・触覚・StatusBar）
    │   └─ utils.ts
    ├─ hooks/
    │   ├─ useAudioEngine.ts # エンジンの生成・dispose をReactに束ねる
    │   └─ useTheme.ts
    └─ components/
        ├─ ui/               # shadcn 風プリミティブ（Radix + cva）
        ├─ Visualizer.tsx
        ├─ LevelMeter.tsx
        ├─ PrivacyDashboard.tsx
        ├─ PresetBar.tsx
        ├─ EffectChainEditor.tsx
        ├─ EffectCard.tsx
        ├─ RealtimePanel.tsx
        ├─ VoiceAnalyzer.tsx
        ├─ FileProcessor.tsx
        └─ Soundboard.tsx
```

---

## 🚀 ローカル起動

```bash
npm install
npm run dev        # http://localhost:5173
```

> `vite.config.ts` が dev サーバーに `Cross-Origin-Opener-Policy` /
> `Cross-Origin-Embedder-Policy` を付与します。これは ffmpeg.wasm が
> `SharedArrayBuffer` を使うために必須です（マイク/Tone.js は不要）。

本番ビルド・確認:

```bash
npm run build      # tsc -b && vite build  → dist/
npm run preview    # COOP/COEP ヘッダ付きで dist を配信
npm test           # vitest（純粋関数のユニットテスト）
```

---

## 📱 Capacitor（iOS / Android）

`capacitor.config.ts` は作成済み（`appId: com.voiceforge.app`）。

```bash
# 1. プラットフォーム追加（初回のみ）
npx cap add ios
npx cap add android

# 2. ビルド → 同期
npm run cap:sync          # = build + cap sync

# 3. 各 IDE で開く
npm run cap:ios           # Xcode（要 macOS）
npm run cap:android       # Android Studio
```

### ネイティブ権限設定（必須）

**iOS — `ios/App/App/Info.plist`**

```xml
<key>NSMicrophoneUsageDescription</key>
<string>声をリアルタイムで変換するためにマイクを使用します。音声は端末内でのみ処理され、外部に送信されません。</string>
```

**Android — `android/app/src/main/AndroidManifest.xml`**

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<!-- 動画/音声の保存に応じて -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="29" />
```

> ネイティブで完全オフラインにしたい場合は、`src/lib/ffmpeg.ts` の `CORE_BASE`
> を自己ホスト（`public/ffmpeg/` に `@ffmpeg/core` の dist を同梱し `/ffmpeg`）へ
> 変更してください。現状は初回のみ CDN から core を取得します。

### PWA アイコン（未同梱）

`public/` に以下の PNG を追加してください（`vite.config.ts` の manifest が参照）:
`pwa-192x192.png` / `pwa-512x512.png` / `apple-touch-icon.png`。
`public/favicon.svg` を元に書き出すのが簡単です（例: `npx @vite-pwa/assets-generator`）。

---

## 🏬 ストア公開時の注意点

### 共通
- **完全ローカル処理**が最大の差別化。審査でもこれを明示すると有利。
- アカウント不要・トラッキング無し・広告無しなら、データ収集の申告も最小で済む。

### App Store（Apple）
- **App Privacy（Nutrition Label）**: 「データを収集しません（No Data Collected）」を選択可能。
- `NSMicrophoneUsageDescription` は必須。空だとリジェクト。
- リアルタイム音声は WKWebView の AudioContext で動作。バックグラウンド継続が必要なら
  Background Modes（audio）の要否を検討（不要なら付けない＝審査が軽い）。
- 「単なる Web サイトのラッパー」と見なされないよう、ネイティブ機能（保存・触覚・
  オフライン動作）と独自 UX を明確にアピール。

### Google Play
- `RECORD_AUDIO` を使う場合、データセーフティ フォームで「音声を録音するが端末外へ
  送信しない」を正確に記載。
- 16KB ページサイズ・ターゲット API レベルの最新要件に追従（Android Studio で対応）。

### プライバシーポリシー文例（そのまま流用可）

> **VoiceForge プライバシーポリシー**
> VoiceForge は、すべての音声処理（録音・変換・再生・保存）をお客様の端末内で
> 完結して実行します。音声データ・動画データ・エフェクト設定を当社サーバーや
> 第三者へ送信・収集・保存することは一切ありません。保存したサウンドクリップや
> プリセットは端末内のストレージ（アプリ領域 / ブラウザの localStorage）にのみ
> 保存されます。アプリのアンインストールにより、これらのデータは削除されます。
> 当社はお客様を識別する情報を取得しません。

---

## 🧠 設計メモ

- **構造差分の最適化**: リアルタイムのスライダー操作では、チェーンの「並び/種類/有効」
  が変わらない限り Tone ノードを作り直さず `applyParams` のみ実行（クリックノイズ・GC を回避）。
- **メモリリーク対策**: `AudioEngine.dispose()` で全ノードを解放。`useAudioEngine` が
  unmount 時に確実に呼ぶ。入力停止は `stopInput()` でエンジン本体を保持。
- **音の一致**: リアルタイムとオフライン（ファイル）で同一の `effects` 定義を再利用。
- **ハウリング対策**: スピーカー出力（モニタリング）は明示 ON のときのみ Destination へ接続。
- **キーポイント調整**: 波形上のキーポイントを `envGain.gain` の
  `setValueAtTime` / `linearRampToValueAtTime` でオフライン書き出し時にスケジュール（線形補間）。
  非ループのプレビューにも同じエンベロープを適用。
- **バンドル分割**: `vite.config.ts` の `manualChunks` で `tone` / `react` / `ui`(Radix+dnd-kit) /
  `ffmpeg` を分離し初期表示を軽量化。ffmpeg core はランタイムに動的取得（初期バンドル非搭載）。
- **ストレージ**: サウンドボードのクリップは `IndexedDB`（`src/lib/idb.ts`）に **Blob を直接保存**し
  localStorage の約5MB上限を回避（base64 化しないので約25%効率化）。旧 localStorage / dataUrl 分は
  初回アクセス時に自動移行＆再生フォールバック。プリセットは小さいため localStorage のまま。
- **テスト / CI**: `vitest` で WAV エンコーダ / プリセット共有 / F0 推定 / エフェクト定義を検証
  （`src/lib/*.test.ts`、DOM 非依存の純粋関数のみ）。`.github/workflows/ci.yml` で
  push/PR ごとに lint(`tsc -b`)・test・build を実行。

---

## 📜 ライセンス / 依存

React 19・Vite 6・TypeScript・Tailwind 3・Tone.js 15・@ffmpeg/ffmpeg・Capacitor 6・
Radix UI・dnd-kit・lucide-react。
