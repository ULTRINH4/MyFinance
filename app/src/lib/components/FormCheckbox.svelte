<script>
  // Drop-in replacement for a raw <input type="checkbox">: same toggle-switch
  // visual already proven in Calendar's "Group by day", now shared so every
  // checkbox in the app looks the same instead of the native browser box.
  let { checked = $bindable(false), name = undefined, disabled = false, ariaLabel = 'Toggle', onchange = undefined } = $props();
</script>

<span class="fcheck" class:disabled>
  <input type="checkbox" {name} bind:checked {disabled} aria-label={ariaLabel} {onchange} />
  <i></i>
</span>

<style>
  .fcheck { position: relative; display: inline-flex; flex-shrink: 0; width: 30px; height: 17px; }
  .fcheck input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .fcheck i {
    position: absolute; inset: 0; border-radius: 99px; background: var(--border-hover);
    transition: background .16s ease;
  }
  .fcheck i::after {
    content: ''; position: absolute; top: 3px; left: 3px; width: 11px; height: 11px;
    border-radius: 50%; background: var(--muted); transition: transform .16s ease, background .16s ease;
  }
  .fcheck input:checked + i { background: var(--accent-soft); }
  .fcheck input:checked + i::after { transform: translateX(13px); background: var(--accent); }
  .fcheck input:focus-visible + i { outline: 2px solid var(--accent-solid); outline-offset: 2px; }
  .fcheck.disabled { opacity: .5; }
  .fcheck.disabled input { cursor: not-allowed; }
</style>
