<script lang="ts">
  let {
    fileName = null,
    fileSizeLabel,
    pageCount,
    charCountLabel,
    statusLabel,
    hasPages = false,
    onPickFile,
    onJumpToTop,
    onJumpToPage,
  } = $props<{
    fileName?: string | null;
    fileSizeLabel: string;
    pageCount: number;
    charCountLabel: string;
    statusLabel: string;
    hasPages?: boolean;
    onPickFile: () => Promise<void>;
    onJumpToTop: () => void;
    onJumpToPage: (pageNumber: number) => void;
  }>();

  function getPageLinks(totalPages: number) {
    if (totalPages <= 6) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    return [1, 2, 3, totalPages - 2, totalPages - 1, totalPages];
  }
</script>

<aside class="sidebar" aria-label="Document sidebar">
  <div class="sidebar__brand" aria-hidden="true">
    <svg viewBox="0 0 64 64" focusable="false">
      <path
        d="M18 10h20l8 8v36H18z"
        fill="none"
        stroke="currentColor"
        stroke-linejoin="round"
        stroke-width="3"
      />
      <path d="M38 10v10h10" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="3" />
      <path
        d="M27 24h8.5c5 0 8.5 3.2 8.5 8s-3.5 8-8.5 8H31v8h-4zM31 36h4.2c2.9 0 4.8-1.5 4.8-4s-1.9-4-4.8-4H31z"
        fill="currentColor"
      />
    </svg>
  </div>

  <div class="sidebar__stats" aria-label="File statistics">
    <article>
      <span>Status</span>
      <strong>{statusLabel}</strong>
    </article>
    <article>
      <span>Size</span>
      <strong>{fileSizeLabel}</strong>
    </article>
    <article>
      <span>Pages</span>
      <strong>{pageCount}</strong>
    </article>
    <article>
      <span>Chars</span>
      <strong>{charCountLabel}</strong>
    </article>
  </div>

  <nav class="sidebar__actions" aria-label="Sidebar actions">
    <button class="sidebar__action" onclick={onPickFile} aria-label="Open PDF">
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M12 5v14M5 12h14"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width="1.7"
        />
      </svg>
    </button>

    {#if hasPages}
      <button class="sidebar__action" onclick={onJumpToTop} aria-label="Jump to top">
        <svg viewBox="0 0 24 24" focusable="false">
          <path
            d="M12 18V6M7 11l5-5 5 5"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.7"
          />
        </svg>
      </button>
    {/if}
  </nav>

  {#if pageCount > 1}
    <div class="sidebar__pages" aria-label="Jump to page">
      {#each getPageLinks(pageCount) as pageNumber (pageNumber)}
        <button
          class="sidebar__page-link"
          aria-label={`Jump to page ${pageNumber}`}
          onclick={() => onJumpToPage(pageNumber)}
        >
          {pageNumber}
        </button>
      {/each}
    </div>
  {/if}

  <p class="sidebar__file" title={fileName ?? "No PDF selected"}>
    {fileName ?? "No PDF"}
  </p>
</aside>
