# PDFParse

Lightweight desktop app for extracting text from PDFs. Built with Svelte 5, Tauri v2, and [@llamaindex/liteparse](https://github.com/run-llama/liteparse).

Extracts text with spatial layout preservation — column alignment and indentation are kept intact. No OCR, no cloud, no Office documents. Just fast, offline, local PDF text extraction.

## Features

- **File picker & drag-and-drop** — open PDFs via native dialog or drag onto the window
- **Spatial text extraction** — preserves the original layout of the PDF
- **Page-by-page display** — editorial page cards with ruled lines and folio numbers
- **Copy & save** — copy all text to clipboard or save as `.txt`
- **Large file warning** — confirmation dialog for files over 100MB
- **Light/dark theme** — follows system preference
- **Cross-platform** — Windows, macOS, Linux

## UI Design — "Ink & Paper"

Neo-editorial aesthetic inspired by luxury publishing and fine stationery.

- **Split-panel layout** — dark vertical sidebar + cream content panel
- **Typography** — Cormorant Garamond (display), DM Sans (UI), JetBrains Mono (extracted text)
- **Page cards** — paper-texture background, ruled lines, corner folds, folio page numbers
- **Ink-line progress** — horizontal shimmer animation during extraction
- **Staggered page entrance** — pages appear sequentially like sheets off a press
- **Animated drop zone** — SVG dash border with rotation, monochrome PDF icon
- **Toast notifications** — countdown bar with auto-dismiss
- **Accessibility** — focus rings, aria-labels, prefers-reduced-motion support

## Architecture

```
┌──────────────┐     invoke()     ┌──────────────┐   spawn sidecar   ┌─────────────────┐
│  Svelte UI   │ ───────────────→ │  Rust Backend │ ───────────────→ │ pdfparse-parser  │
│  (webview)   │ ←─────────────── │  (Tauri cmds) │ ←─────────────── │ (liteparse node) │
└──────────────┘  ExtractionResult└──────────────┘   JSON stdout     └─────────────────┘
```

LiteParse is a Node.js library, so it runs as a Tauri **sidecar** — a standalone binary compiled with [pkg](https://github.com/yao-pkg/pkg), bundled alongside the app. No Node.js installation required.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Svelte 5, Vite |
| Backend | Tauri v2, Rust |
| PDF parsing | @llamaindex/liteparse |
| Plugins | tauri-plugin-dialog, tauri-plugin-clipboard-manager, tauri-plugin-shell |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri v2 [system dependencies](https://v2.tauri.app/start/prerequisites/)

## Getting Started

```bash
# Install frontend dependencies
pnpm install

# Install sidecar dependencies and build sidecar binary
pnpm sidecar:install
pnpm build:sidecar

# Run in development mode
pnpm tauri dev
```

## Build

```bash
# Build release binary (includes sidecar)
pnpm tauri build
```

Output binaries are in `src-tauri/target/release/bundle/`.

## Scripts

| Command | Description |
|---------|-----------|
| `pnpm dev` | Start Vite dev server (frontend only) |
| `pnpm tauri dev` | Start full Tauri dev mode (frontend + backend) |
| `pnpm build:sidecar` | Build liteparse sidecar for current platform |
| `pnpm build:sidecar:all` | Build sidecar for all platforms |
| `pnpm tauri build` | Build release binary |
| `pnpm check` | Run Svelte/TypeScript type checking |

## Project Structure

```
src/                        # Svelte frontend
├── App.svelte              # Main app (layout, state wiring)
├── lib/
│   ├── state.svelte.ts     # Reactive state (Svelte 5 runes)
│   ├── Sidebar.svelte      # Dark vertical sidebar with stats
│   ├── TitleBar.svelte     # Compact title bar with status badge
│   ├── DropZone.svelte     # File picker + animated drag-and-drop
│   ├── TextDisplay.svelte  # Page cards with ruled lines
│   └── ActionBar.svelte    # Copy / Save buttons
src-tauri/                  # Tauri backend
├── src/
│   ├── lib.rs              # Tauri commands (extract_text, save_text)
│   └── pdf.rs              # Data structures
├── sidecar/
│   ├── parser.mjs          # LiteParse extraction logic
│   └── build-sidecar.mjs   # Sidecar build script (esbuild + pkg)
```

## License

MIT
