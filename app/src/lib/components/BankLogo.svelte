<script>
  import { bankLogos } from '$lib/data/logos.js';
  let { badge = '', color = 'var(--accent-solid)', size = 38, radius, fontSize = 10 } = $props();
  const computedRadius = $derived(radius ?? Math.round(size * 0.28));
  const src = $derived(bankLogos[badge]);
</script>

{#if src}
  <img class="bank-logo" src={src} alt={badge} width={size} height={size} style="width:{size}px; height:{size}px; border-radius:{computedRadius}px;" />
{:else}
  <span
    class="bank-logo-fallback"
    style="width:{size}px; height:{size}px; border-radius:{computedRadius}px; background:color-mix(in srgb, {color} 24%, var(--panel-strong)); color:{color}; font-size:{fontSize}px;"
  >{badge}</span>
{/if}

<style>
  .bank-logo {
    display: block;
    flex-shrink: 0;
    object-fit: cover;
  }
  .bank-logo-fallback {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    font-weight: 900;
  }
</style>
