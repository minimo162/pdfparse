# PDFParse タスク実施レポート

## 1. 概要

PDFParse は、Svelte 5 + Tauri v2 を用いた PDF テキスト抽出デスクトップアプリとして実装済みです。
PDF 抽出は `@llamaindex/liteparse` を使った Node sidecar 方式に切り替えられており、`pkg` により standalone binary として実行できます。

## 2. タスク実施結果

`.taskmaster/tasks/tasks.json` に定義された 10 タスクはすべて `done` です。

| ID | タスク | 状態 |
| --- | --- | --- |
| 1 | Initialize Tauri v2 + Svelte project | done |
| 2 | Create liteparse sidecar parser | done |
| 3 | Add Tauri plugins (dialog, clipboard, shell) | done |
| 4 | Build main app layout (Svelte) | done |
| 5 | Implement file selection (picker + drag-and-drop) | done |
| 6 | Implement text extraction flow (frontend ↔ sidecar ↔ backend) | done |
| 7 | Implement copy and save actions | done |
| 8 | Polish UI and error states | done |
| 9 | Add large file warning | done |
| 10 | Test and build for distribution | done |

## 3. 実装内容

### フロントエンド

- 単一ウィンドウ構成の UI を実装
- PDF 選択、ドラッグ&ドロップ、抽出中表示、ページ区切りつきテキスト表示を実装
- コピー、TXT 保存、トースト通知、100MB 超ファイル確認を実装
- システム連動のライト / ダークテーマを実装

主要ファイル:

- `src/App.svelte`
- `src/lib/state.svelte.ts`

### バックエンド

- Tauri command として `inspect_pdf`, `extract_text`, `save_text` を実装
- `tauri-plugin-dialog`, `tauri-plugin-clipboard-manager`, `tauri-plugin-shell` を登録
- sidecar 実行結果の JSON パースとエラーマッピングを実装

主要ファイル:

- `src-tauri/src/lib.rs`
- `src-tauri/src/pdf.rs`
- `src-tauri/capabilities/default.json`

### liteparse sidecar

- `src-tauri/sidecar/parser.mjs` で PDF.js + liteparse の spatial text projection を使う抽出処理を実装
- OCR は無効化
- `pkg` の ESM 制約回避のため、`esbuild` で sidecar を single-file bundle 化
- build 時 staging を使って `pdfjs` runtime asset を同梱し、build 後に不要生成物を自動削除
- standalone binary のみで動作する構成に整理し、`node` フォールバックは削除済み

主要ファイル:

- `src-tauri/sidecar/parser.mjs`
- `src-tauri/sidecar/build-sidecar.mjs`
- `src-tauri/sidecar/package.json`
- `package.json`

## 4. 検証結果

確認済み:

- `pnpm check`
- `cargo check`
- `cargo test`
- `pnpm build`
- standalone sidecar 実行確認

sidecar の確認結果:

- `./src-tauri/sidecar/pdfparse-parser-x86_64-unknown-linux-gnu /tmp/pdfparse-simple.pdf`
- 出力: `{"pages":["Hello LiteParse"],"page_count":1,"char_count":15}`

Rust テスト確認:

- sidecar 成功 JSON のパース
- structured error のパース
- stderr テキスト fallback

Tauri 設定確認:

- bundle identifier の `.app` 警告は解消済み
- `identifier` は `com.pdfparse.desktop`

## 5. 成果物

確認できた配布物:

- `src-tauri/target/release/bundle/deb/PDFParse_0.1.0_amd64.deb`
- `src-tauri/target/release/bundle/rpm/PDFParse-0.1.0-1.x86_64.rpm`
- `src-tauri/target/release/bundle/appimage/PDFParse_0.1.0_amd64.AppImage`

## 6. 現時点の残課題

Taskmaster 上の未完了タスクはありません。

追加でやる価値があるもの:

- 実 GUI 上での手動確認
- 実際の暗号化 PDF、画像-only PDF、100+ ページ PDF を用いた回帰確認
- 必要に応じた最終リリースビルドの再生成
