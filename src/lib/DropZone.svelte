<script lang="ts">
  let { loading = false, dragActive = false, onPickFile } = $props<{
    loading?: boolean;
    dragActive?: boolean;
    onPickFile: () => Promise<void>;
  }>();
</script>

<section class:drop-zone--active={dragActive} class="drop-zone">
  <div class="drop-zone__frame" aria-hidden="true">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="2" y="2" width="96" height="96" rx="16" ry="16"></rect>
    </svg>
  </div>

  <div class="drop-zone__content">
    <div class="drop-zone__icon" aria-hidden="true">
      <svg viewBox="0 0 80 80" focusable="false">
        <path
          d="M22 11h25l11 11v46H22z"
          fill="none"
          stroke="currentColor"
          stroke-linejoin="round"
          stroke-width="2.8"
        />
        <path d="M47 11v14h14" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2.8" />
        <path d="M30 39h20M30 48h20M30 57h14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.8" />
      </svg>
    </div>

    <p class="drop-zone__eyebrow">Editorial extraction</p>
    <h2>Drop your PDF</h2>
    <p class="drop-zone__body">or click to browse — text extraction in seconds, fully local and OCR-free.</p>
    <button class="drop-zone__button" onclick={onPickFile} disabled={loading}>
      {loading ? "Extracting..." : "Choose PDF"}
    </button>
  </div>
</section>
