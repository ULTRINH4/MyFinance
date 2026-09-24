<script>
  import '$lib/styles/tokens.css';
  import { page } from '$app/stores';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MobileGestures from '$lib/components/MobileGestures.svelte';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { applyAppearance, loadAppearance } from '$lib/data/appearance.js';
  import { initFinance } from '$lib/stores/finance.js';

  let { children, data } = $props();
  const isAuthRoute = $derived($page.url.pathname.startsWith('/login'));

  // Runs during SSR too (unlike $effect, which is browser-only) so the
  // very first HTML the server sends already has real balances — without
  // this, every page load/F5 would flash zeroed data until hydration ran.
  initFinance(data.financeData);

  // data.financeData only changes when the layout's server load reruns
  // post-mount (e.g. the redirect right after login) — the call above only
  // covers the initial SSR/mount. Guarded to skip its own first run so it
  // doesn't just repeat the call above.
  let initializedOnce = false;
  $effect(() => {
    const financeData = data.financeData;
    if (!initializedOnce) { initializedOnce = true; return; }
    initFinance(financeData);
  });

  // Runs during SSR too, same reasoning as initFinance above: the store is
  // read straight into the template's class:private below, so the very
  // first HTML (server-rendered, pre-hydration) already has money masked —
  // doing this in an $effect instead left a flash of unmasked balances on
  // every load until the browser got around to running effects.
  if (data.user) privateMode.hydrate(data.user.privateMode);

  $effect(() => {
    applyAppearance(loadAppearance());
  });

  $effect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js');
    }
  });
</script>

<div class="app-shell" class:auth={isAuthRoute} class:private={$privateMode}>
  {#if !isAuthRoute}<Sidebar /><MobileGestures />{/if}
  <main class="app-main">
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
    min-height: 100dvh;
  }
  .app-main {
    flex: 1;
    min-width: 0;
    max-width: 100%;
    overflow-x: clip;
    display: flex;
    flex-direction: column;
  }
</style>
