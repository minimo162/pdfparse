<script lang="ts">
  let { pages = [] } = $props<{ pages: string[] }>();
</script>

<section class="text-display" id="page-stack" aria-live="polite">
  {#each pages as page, index (index)}
    <article class="page-card" id={`page-${index + 1}`} style={`--page-index:${index};`}>
      <header class="page-card__header">
        <p>Extracted sheet</p>
        <span>Folio {index + 1}</span>
      </header>
      <pre>{page}</pre>
    </article>
  {/each}
</section>
