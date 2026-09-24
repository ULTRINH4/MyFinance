<script>
  import { brandLogos } from '$lib/data/logos.js';
  let { brand = '', height = 14 } = $props();
  const src = $derived(brandLogos[brand]);
</script>

{#if src}<img class="brand-logo" src={src} alt={brand} style="height:{height}px;" />{/if}

<style>
  .brand-logo {
    display: inline-block;
    vertical-align: middle;
    border-radius: 3px;
  }
</style>
