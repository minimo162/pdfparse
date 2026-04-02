<script lang="ts">
  let { fileName = null, status } = $props<{
    fileName?: string | null;
    status: { label: string; tone: "idle" | "working" | "success" | "error" };
  }>();
</script>

<header class="title-bar">
  <div>
    <p class="title-bar__eyebrow">Ink &amp; Paper extraction desk</p>
    <h1 title={fileName ?? "Drop your PDF"}>{fileName ?? "Drop your PDF"}</h1>
  </div>

  <div class="title-bar__meta">
    <span class={`status-badge status-badge--${status.tone}`}>{status.label}</span>
    <p>Local only</p>
  </div>
</header>
