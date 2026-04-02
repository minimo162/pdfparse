<script lang="ts">
  import { fade } from "svelte/transition";

  let { pages = [] } = $props<{ pages: string[] }>();
</script>

<section class="text-display">
  {#each pages as page, index (index)}
    <article class="page" transition:fade={{ duration: 180 }}>
      <header>--- Page {index + 1} ---</header>
      <pre>{page}</pre>
    </article>
  {/each}
</section>
