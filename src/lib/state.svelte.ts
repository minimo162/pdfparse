export interface AppState {
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  pages: string[];
  pageCount: number;
  charCount: number;
  loading: boolean;
  error: string | null;
  dragActive: boolean;
  toast: { kind: "success" | "error"; message: string } | null;
}

const initialState: AppState = {
  filePath: null,
  fileName: null,
  fileSize: null,
  pages: [],
  pageCount: 0,
  charCount: 0,
  loading: false,
  error: null,
  dragActive: false,
  toast: null,
};

export const appState = $state<AppState>({ ...initialState });

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function resetExtraction() {
  appState.pages = [];
  appState.pageCount = 0;
  appState.charCount = 0;
  appState.error = null;
}

export function setSelectedFile(filePath: string, fileName: string, fileSize: number) {
  appState.filePath = filePath;
  appState.fileName = fileName;
  appState.fileSize = fileSize;
}

export function setLoading(loading: boolean) {
  appState.loading = loading;
}

export function setDragActive(active: boolean) {
  appState.dragActive = active;
}

export function setExtraction(pages: string[]) {
  appState.pages = pages;
  appState.pageCount = pages.length;
  appState.charCount = pages.join("").length;
  appState.error = null;
}

export function setError(message: string) {
  appState.error = message;
}

export function clearError() {
  appState.error = null;
}

export function showToast(kind: "success" | "error", message: string) {
  appState.toast = { kind, message };
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    appState.toast = null;
  }, 3000);
}

export function getExportText() {
  return appState.pages
    .map((page, index) => `--- Page ${index + 1} ---\n${page}`)
    .join("\n\n");
}
