<script>
  import Icon from '$lib/components/Icon.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar.js';

  let { eyebrow = '', title = '', subtitle = '', backHref = null, maxWidth = '1120px', stackedActions = false, children } = $props();
</script>

<header class="page-header" class:stacked-actions={stackedActions} style="width:min({maxWidth}, 100%); margin:0 auto;">
  {#if backHref}
    <a class="icon-btn mobile-only" href={backHref} aria-label="Back"><Icon name="chevronLeft" size={19} /></a>
  {:else}
    <button class="icon-btn mobile-only" onclick={() => sidebarOpen.set(true)} aria-label="Open menu"><Icon name="menu" size={19} /></button>
  {/if}
  <div class="header-copy">
    <span class="eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    {#if subtitle}<small>{subtitle}</small>{/if}
  </div>
  {@render children?.()}
</header>

<style>
  .page-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 24px 28px 18px;
  }
  .header-copy small {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: 11px;
  }
  .eyebrow {
    color: var(--accent);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .page-header h1 {
    margin: 2px 0 0;
    font-size: 24px;
  }
  .icon-btn {
    display: flex;
    width: 36px;
    height: 36px;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .mobile-only {
    display: none;
  }
  @media (max-width: 900px) {
    .mobile-only {
      display: flex;
    }
    .page-header {
      padding: 16px 12px 10px;
    }
    .page-header h1 {
      font-size: 20px;
    }
    .page-header.stacked-actions {
      position: relative;
      padding-bottom: 58px;
    }
  }
</style>
