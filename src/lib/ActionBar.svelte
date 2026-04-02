<script lang="ts">
  let { disabled = true, loading = false, onCopy, onSave } = $props<{
    disabled?: boolean;
    loading?: boolean;
    onCopy: () => Promise<void>;
    onSave: () => Promise<void>;
  }>();
</script>

<div class="action-bar">
  <button class="action-bar__button" onclick={onCopy} disabled={disabled || loading}>Copy All</button>
  <button class="action-bar__button action-bar__button--primary" onclick={onSave} disabled={disabled || loading}>
    Save as TXT
  </button>
</div>
