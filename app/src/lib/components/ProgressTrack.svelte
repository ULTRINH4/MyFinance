<script>
  let { percent = 0, color = 'var(--accent-solid)', height = 6, style = '' } = $props();
</script>

<div class="progress-track" style="height:{height}px; {style}">
  <span style="width:{Math.min(100, Math.max(0, percent))}%; background:{color};"></span>
</div>

<style>
  .progress-track {
    border-radius: 99px;
    background: var(--border-soft);
    overflow: hidden;
  }
  .progress-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
</style>
