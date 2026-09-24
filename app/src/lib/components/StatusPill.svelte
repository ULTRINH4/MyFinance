<script>
  let { tone = 'neutral', children } = $props();
</script>

<span class="status-pill {tone}">{@render children?.()}</span>

<style>
  .status-pill {
    padding: 4px 8px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 800;
  }
  .status-pill.planned {
    background: rgba(245, 158, 11, 0.16);
    color: var(--planned);
  }
  .status-pill.positive {
    background: var(--positive-soft);
    color: var(--positive);
  }
  .status-pill.negative {
    background: var(--negative-soft);
    color: var(--negative);
  }
  .status-pill.neutral {
    background: var(--panel-strong);
    color: var(--muted);
  }
</style>
