<script lang="ts">
  let { loading = false, dragActive = false, onPickFile } = $props<{
    loading?: boolean;
    dragActive?: boolean;
    onPickFile: () => Promise<void>;
  }>();
</script>

<section class:drag-active={dragActive} class="drop-zone">
  <div class="drop-zone__panel">
    <p class="drop-zone__eyebrow">Offline PDF text extraction</p>
    <h1>Drop a PDF here</h1>
    <p class="drop-zone__body">
      Open a text-based PDF, inspect the extracted pages, then copy or save the result as plain text.
    </p>
    <button class="drop-zone__button" onclick={onPickFile} disabled={loading}>
      {loading ? "Extracting..." : "Choose PDF"}
    </button>
    <p class="drop-zone__hint">Drag and drop also works from your desktop.</p>
  </div>
</section>
