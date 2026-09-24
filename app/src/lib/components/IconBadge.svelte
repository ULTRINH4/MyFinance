<script>
  let { size = 42, radius, background, color, fontSize = 11, fontWeight = 900, children } = $props();
  const computedRadius = $derived(radius ?? Math.round(size * 0.28));
</script>

<span
  class="icon-badge"
  style="width:{size}px; height:{size}px; border-radius:{computedRadius}px; background:{background}; color:{color}; font-size:{fontSize}px; font-weight:{fontWeight};"
>
  {@render children?.()}
</span>

<style>
  .icon-badge {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }
</style>
