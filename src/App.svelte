<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";
  import { confirm, open, save } from "@tauri-apps/plugin-dialog";
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import ActionBar from "./lib/ActionBar.svelte";
  import DropZone from "./lib/DropZone.svelte";
  import TextDisplay from "./lib/TextDisplay.svelte";
  import {
    appState,
    clearError,
    getExportText,
    resetExtraction,
    setDragActive,
    setError,
    setExtraction,
    setLoading,
    setSelectedFile,
    showToast,
  } from "./lib/state.svelte";
  import "./app.css";

  interface ExtractionResult {
    pages: string[];
    page_count: number;
    char_count: number;
  }

  interface FileInfo {
    file_name: string;
    file_size: number;
  }

  const LARGE_FILE_BYTES = 100 * 1024 * 1024;

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  async function selectFromDialog() {
    const result = await open({
      directory: false,
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (typeof result === "string") {
      await loadPdf(result);
    }
  }

  async function loadPdf(filePath: string) {
    setLoading(true);
    clearError();
    resetExtraction();

    try {
      const fileInfo = await invoke<FileInfo>("inspect_pdf", { filePath });
      const shouldContinue =
        fileInfo.file_size <= LARGE_FILE_BYTES ||
        (await confirm(
          `This file is ${formatFileSize(fileInfo.file_size)}. Extraction may take longer than usual. Continue?`,
          {
            title: "Large PDF",
            kind: "warning",
          },
        ));

      setSelectedFile(filePath, fileInfo.file_name, fileInfo.file_size);

      if (!shouldContinue) {
        return;
      }

      const result = await invoke<ExtractionResult>("extract_text", { filePath });
      setExtraction(result.pages);
      appState.pageCount = result.page_count;
      appState.charCount = result.char_count;
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
      setDragActive(false);
    }
  }

  async function handleCopy() {
    try {
      await writeText(getExportText());
      showToast("success", "Copied!");
    } catch {
      showToast("error", "Copy failed");
    }
  }

  async function handleSave() {
    try {
      const path = await save({
        defaultPath: appState.fileName?.replace(/\.pdf$/i, ".txt") ?? "extracted.txt",
        filters: [{ name: "Text", extensions: ["txt"] }],
      });

      if (!path) {
        return;
      }

      await invoke("save_text", { content: getExportText(), path });
      showToast("success", "Saved!");
    } catch {
      showToast("error", "Save failed");
    }
  }

  onMount(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const install = async () => {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (disposed) {
          return;
        }

        if (event.payload.type === "over" || event.payload.type === "enter") {
          setDragActive(true);
          return;
        }

        if (event.payload.type === "leave") {
          setDragActive(false);
          return;
        }

        if (event.payload.type === "drop") {
          const [path] = event.payload.paths;
          if (path) {
            void loadPdf(path);
          } else {
            setDragActive(false);
          }
        }
      });
    };

    void install();

    return () => {
      disposed = true;
      unlisten?.();
    };
  });
</script>

<svelte:head>
  <meta name="description" content="Extract text from local PDFs with a desktop Tauri app." />
</svelte:head>

<div class="shell">
  <div class="shell__backdrop"></div>

  <main class="app">
    <header class="app__header">
      <div>
        <p class="app__kicker">PDFParse</p>
        <h1>Desktop PDF text extraction</h1>
      </div>

      <div class="stats">
        <div>
          <span>File</span>
          <strong>{appState.fileName ?? "No PDF selected"}</strong>
        </div>
        <div>
          <span>Size</span>
          <strong>{formatFileSize(appState.fileSize)}</strong>
        </div>
        <div>
          <span>Pages</span>
          <strong>{appState.pageCount}</strong>
        </div>
        <div>
          <span>Characters</span>
          <strong>{appState.charCount.toLocaleString()}</strong>
        </div>
      </div>
    </header>

    {#if appState.error}
      <aside class="alert" transition:fade>{appState.error}</aside>
    {/if}

    <section class="app__main">
      {#if appState.pages.length}
        <div class="viewer" transition:fly={{ y: 14, duration: 220 }}>
          <div class="viewer__toolbar">
            <p>Extracted text is shown page by page and stays local on this device.</p>
            <button class="viewer__button" onclick={selectFromDialog} disabled={appState.loading}>
              Open another PDF
            </button>
          </div>
          <TextDisplay pages={appState.pages} />
        </div>
      {:else}
        <DropZone
          loading={appState.loading}
          dragActive={appState.dragActive}
          onPickFile={selectFromDialog}
        />
      {/if}
    </section>

    <footer class="app__footer">
      <div class="status-line">
        {#if appState.loading}
          <span class="spinner" aria-hidden="true"></span>
          <span>Extracting text...</span>
        {:else if appState.fileName}
          <span>Ready to copy or save.</span>
        {:else}
          <span>Select a single text-based PDF to begin.</span>
        {/if}
      </div>

      <ActionBar
        disabled={!appState.pages.length}
        loading={appState.loading}
        onCopy={handleCopy}
        onSave={handleSave}
      />
    </footer>
  </main>

  {#if appState.toast}
    <div class={`toast toast--${appState.toast.kind}`} transition:fly={{ y: 16, duration: 180 }}>
      {appState.toast.message}
    </div>
  {/if}
</div>
