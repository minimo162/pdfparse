<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";
  import { confirm, open, save } from "@tauri-apps/plugin-dialog";
  import { onMount } from "svelte";
  import ActionBar from "./lib/ActionBar.svelte";
  import DropZone from "./lib/DropZone.svelte";
  import Sidebar from "./lib/Sidebar.svelte";
  import TextDisplay from "./lib/TextDisplay.svelte";
  import TitleBar from "./lib/TitleBar.svelte";
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

  const formatCompactNumber = (value: number) => value.toLocaleString();

  const getStatusTone = () => {
    if (appState.loading) {
      return { label: "Extracting", tone: "working" as const };
    }

    if (appState.error) {
      return { label: "Error", tone: "error" as const };
    }

    if (appState.pages.length) {
      return { label: "Ready", tone: "success" as const };
    }

    return { label: "Idle", tone: "idle" as const };
  };

  const getStatusText = () => {
    if (appState.loading) {
      return "Ink line is running across the press while text is extracted.";
    }

    if (appState.error) {
      return "Review the error note, then try another PDF.";
    }

    if (appState.pages.length) {
      return "Extraction finished locally. Copy the text or save it as plain TXT.";
    }

    return "Drop a single text-based PDF or browse from disk to begin.";
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
      showToast("success", "Copied to clipboard");
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
      showToast("success", "Saved as TXT");
    } catch {
      showToast("error", "Save failed");
    }
  }

  function jumpToTop() {
    document.getElementById("page-stack")?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function jumpToPage(pageNumber: number) {
    document.getElementById(`page-${pageNumber}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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

  <div class="workspace">
    <Sidebar
      fileName={appState.fileName}
      fileSizeLabel={formatFileSize(appState.fileSize)}
      pageCount={appState.pageCount}
      charCountLabel={formatCompactNumber(appState.charCount)}
      statusLabel={getStatusTone().label}
      hasPages={appState.pages.length > 0}
      onPickFile={selectFromDialog}
      onJumpToTop={jumpToTop}
      onJumpToPage={jumpToPage}
    />

    <main class="panel">
      <TitleBar fileName={appState.fileName} status={getStatusTone()} />

      <section class="mobile-stats" aria-label="Document statistics">
        <article>
          <span>Size</span>
          <strong>{formatFileSize(appState.fileSize)}</strong>
        </article>
        <article>
          <span>Pages</span>
          <strong>{appState.pageCount}</strong>
        </article>
        <article>
          <span>Chars</span>
          <strong>{formatCompactNumber(appState.charCount)}</strong>
        </article>
      </section>

      {#if appState.error}
        <aside class="error-banner" role="alert" aria-live="assertive">
          <div class="error-banner__icon" aria-hidden="true">!</div>
          <p>{appState.error}</p>
          <button class="error-banner__dismiss" onclick={clearError}>Dismiss</button>
        </aside>
      {/if}

      <section class="panel__main">
        {#if appState.pages.length}
          <TextDisplay pages={appState.pages} />
        {:else}
          <DropZone
            loading={appState.loading}
            dragActive={appState.dragActive}
            onPickFile={selectFromDialog}
          />
        {/if}
      </section>

      <footer class="status-bar">
        <div class="status-bar__meta">
          <p class="status-bar__text">{getStatusText()}</p>
          <div class:status-bar__ink--active={appState.loading} class="status-bar__ink" aria-hidden="true">
            <span></span>
          </div>
        </div>

        <ActionBar
          disabled={!appState.pages.length}
          loading={appState.loading}
          onCopy={handleCopy}
          onSave={handleSave}
        />
      </footer>
    </main>
  </div>

  {#if appState.toast}
    <div class={`toast toast--${appState.toast.kind}`} role="status" aria-live="polite">
      <p>{appState.toast.message}</p>
      <div class="toast__meter"></div>
    </div>
  {/if}
</div>
