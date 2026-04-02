# Codex Prompt — PDFParse Implementation

## Project Overview

Build a desktop PDF text extraction app using **Svelte 5 + Tauri v2 + @llamaindex/liteparse**.
The app extracts text from PDFs with spatial layout preservation (no OCR, no Office docs).
Users can view, copy, and save the extracted text.

## Key Documents

- PRD: `.taskmaster/docs/prd.txt`
- Tasks: `.taskmaster/tasks/tasks.json`

## Technical Stack

| Layer     | Technology                                          |
|-----------|-----------------------------------------------------|
| Frontend  | Svelte 5, Vite, CSS                                 |
| Backend   | Tauri v2, Rust                                      |
| PDF Parse | @llamaindex/liteparse (Node.js sidecar)             |
| Plugins   | tauri-plugin-dialog, tauri-plugin-clipboard-manager, tauri-plugin-shell |

## Architecture: Sidecar Pattern

LiteParse is a Node.js/TypeScript library — it cannot run directly in Tauri's webview.
We use Tauri's **sidecar** pattern: a standalone Node.js binary compiled with `pkg`,
bundled alongside the Tauri app.

```
┌──────────────┐      invoke()      ┌──────────────┐    spawn sidecar    ┌─────────────────┐
│  Svelte UI   │ ──────────────────→│  Rust Backend │ ──────────────────→│ pdfparse-parser  │
│  (webview)   │ ←──────────────────│  (Tauri cmds) │ ←──────────────────│ (liteparse node) │
└──────────────┘   ExtractionResult └──────────────┘    JSON stdout      └─────────────────┘
```

## Implementation Instructions

### Phase 1: Project Setup (Task 1) — DONE

Project already scaffolded with `create-tauri-app` (Svelte template).

### Phase 2: LiteParse Sidecar (Task 2)

**Step 1: Create the parser script**

Create `src-tauri/sidecar/parser.mjs`:
```javascript
import { LiteParse } from '@llamaindex/liteparse';

const filePath = process.argv[2];
if (!filePath) {
  console.error(JSON.stringify({ error: 'No file path provided' }));
  process.exit(1);
}

try {
  const parser = new LiteParse({ ocrEnabled: false });
  const result = await parser.parse(filePath);

  // result.text contains spatial text; split by page if available
  const pages = result.pages
    ? result.pages.map(p => p.text || '')
    : [result.text || ''];

  const output = {
    pages: pages,
    page_count: pages.length,
    char_count: pages.reduce((sum, p) => sum + p.length, 0),
  };

  console.log(JSON.stringify(output));
} catch (err) {
  const message = err.message || String(err);
  if (message.includes('password') || message.includes('encrypt')) {
    console.error(JSON.stringify({ error: 'This PDF is password-protected' }));
  } else if (message.includes('no text')) {
    console.error(JSON.stringify({ error: 'No extractable text found' }));
  } else {
    console.error(JSON.stringify({ error: `Failed to extract text: ${message}` }));
  }
  process.exit(1);
}
```

**Step 2: Install dependencies and compile**
```bash
cd src-tauri/sidecar
npm init -y
npm install @llamaindex/liteparse
npm install -g @yao-pkg/pkg

# Compile to standalone binary for each platform
# The binary name must match Tauri's externalBin naming convention:
# {name}-{target_triple}
pkg parser.mjs --target node18-linux-x64 --output pdfparse-parser-x86_64-unknown-linux-gnu
pkg parser.mjs --target node18-macos-x64 --output pdfparse-parser-x86_64-apple-darwin
pkg parser.mjs --target node18-macos-arm64 --output pdfparse-parser-aarch64-apple-darwin
pkg parser.mjs --target node18-win-x64 --output pdfparse-parser-x86_64-pc-windows-msvc.exe
```

**Step 3: Configure Tauri sidecar**

In `src-tauri/tauri.conf.json`, add:
```json
{
  "bundle": {
    "externalBin": ["sidecar/pdfparse-parser"]
  }
}
```

### Phase 3: Tauri Plugins & Rust Backend (Tasks 3, 6)

**Cargo.toml dependencies:**
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Note: **No pdf-extract crate.** PDF parsing is handled by the liteparse sidecar.

**src-tauri/src/lib.rs:**
```rust
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize, Deserialize)]
pub struct ExtractionResult {
    pub pages: Vec<String>,
    pub page_count: usize,
    pub char_count: usize,
}

#[derive(Deserialize)]
struct SidecarError {
    error: String,
}

#[tauri::command]
async fn extract_text(app: tauri::AppHandle, file_path: String) -> Result<ExtractionResult, String> {
    let output = app
        .shell()
        .sidecar("pdfparse-parser")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .arg(&file_path)
        .output()
        .await
        .map_err(|e| format!("Failed to run parser: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        serde_json::from_str::<ExtractionResult>(&stdout)
            .map_err(|e| format!("Failed to parse result: {}", e))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if let Ok(err) = serde_json::from_str::<SidecarError>(&stderr) {
            Err(err.error)
        } else {
            Err(format!("Parser failed: {}", stderr))
        }
    }
}

#[tauri::command]
fn save_text(content: String, path: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to save: {}", e))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![extract_text, save_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Capabilities config** (`src-tauri/capabilities/default.json`):
```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-ask",
    "clipboard-manager:default",
    "clipboard-manager:allow-write-text",
    "shell:default",
    "shell:allow-execute"
  ]
}
```

### Phase 4: Svelte Frontend (Tasks 4, 5, 6)

Tasks 4 and 5 (layout, file selection) are already done.

**Key frontend change for Task 6 — extraction call is the same:**
```typescript
import { invoke } from '@tauri-apps/api/core';

// The Rust command handles the sidecar internally — frontend API is unchanged
const result = await invoke('extract_text', { filePath: selectedPath });
```

**Component structure:**
```
src/
├── App.svelte          # Main layout (header + main + footer)
├── lib/
│   ├── state.svelte.ts # App state with runes
│   ├── DropZone.svelte # File picker + drag-and-drop
│   ├── TextDisplay.svelte # Scrollable text with page separators
│   └── ActionBar.svelte   # Copy + Save buttons
└── app.css             # Global styles with light/dark theme
```

**Key frontend behaviors:**
1. On file select → call `invoke('extract_text', { filePath })` from `@tauri-apps/api/core`
2. Show loading spinner while awaiting result
3. Render each page with `--- Page N ---` separator
4. Copy button → use `writeText()` from `@tauri-apps/plugin-clipboard-manager`
5. Save button → use `save()` from `@tauri-apps/plugin-dialog` then `invoke('save_text', { content, path })`

### Phase 5: Polish & Error Handling (Tasks 7, 8, 9)

- Error messages: render in a styled alert box, not console
- Empty state: show a centered drop zone with dashed border and "Drop a PDF here" text
- Dark mode: use `@media (prefers-color-scheme: dark)` for all color tokens
- Large file warning: check `fileSize > 100 * 1024 * 1024` before extraction, confirm with dialog
- Success feedback: brief "Copied!" / "Saved!" toast that auto-dismisses after 2 seconds

### Phase 6: Build & Test (Task 10)

```bash
# Ensure sidecar binary exists for current platform first
cargo tauri build
```

Test matrix:
- Plain text PDF → text extracted with spatial layout preserved
- Image-only PDF → "No extractable text found" error
- Encrypted PDF → "This PDF is password-protected" error
- Corrupt file → "Unable to read this file" error
- 100+ page PDF → completes in reasonable time
- Verify sidecar binary is bundled in the app package

## Constraints

- Use **@llamaindex/liteparse** for PDF parsing — do NOT use pdf-extract, PyMuPDF, or other libraries
- Set `ocrEnabled: false` — do NOT enable OCR
- Do NOT add Office document support (even though liteparse supports it)
- Do NOT add cloud/server features
- Keep dependencies minimal
- Single file at a time (no batch processing)
- Tauri v2 (not v1) — use the v2 API patterns
- Svelte 5 with runes — not Svelte 4 syntax
- The sidecar binary must be compiled and placed correctly for Tauri bundling

## Task Execution Order

```
Task 1 (scaffold) ✅ DONE
├── Task 2 (liteparse sidecar) ← NEXT
├── Task 3 (Tauri plugins + shell)
└── Task 4 (Svelte layout) ✅ DONE
      └── Task 5 (file selection) ✅ DONE
            └── Task 6 (extraction flow via sidecar)
                  ├── Task 7 (copy/save)
                  └── Task 9 (large file warning)
                        └── Task 8 (UI polish)
                              └── Task 10 (test & build)
```

Execute tasks in dependency order. Mark each task complete in `.taskmaster/tasks/tasks.json` by setting `"status": "done"` after finishing it.
