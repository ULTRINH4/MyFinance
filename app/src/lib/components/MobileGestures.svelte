<script>
  // Two touch gestures a PWA needs since it loses the browser chrome that
  // used to provide them for free: pull-down-to-refresh (native browser tabs
  // have this, a standalone PWA window doesn't) and edge-swipe to open/close
  // the sidebar on mobile (there's no back/forward swipe chrome to borrow
  // the gesture from either).
  import { invalidateAll } from '$app/navigation';
  import { sidebarOpen } from '$lib/stores/sidebar.js';

  const PULL_THRESHOLD = 70;
  const EDGE_ZONE = 36;
  const SWIPE_THRESHOLD = 60;

  let pulling = $state(false);
  let pullDistance = $state(0);
  let refreshing = $state(false);

  function findScrollParent(el) {
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return document.scrollingElement;
  }

  let touchStartX = 0, touchStartY = 0;
  let pullArmed = false, pullScrollParent = null;
  let swipeArmed = false, swipeEdge = false;

  function onTouchStart(event) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    pullScrollParent = findScrollParent(event.target);
    pullArmed = pullScrollParent.scrollTop === 0 && !refreshing;

    swipeEdge = touchStartX <= EDGE_ZONE;
    swipeArmed = swipeEdge || $sidebarOpen;
  }

  function onTouchMove(event) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (pullArmed && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      if (pullScrollParent.scrollTop > 0) { pullArmed = false; pulling = false; return; }
      pulling = true;
      pullDistance = Math.min(dy * 0.5, 100);
      event.preventDefault();
      return;
    }

    if (swipeArmed && Math.abs(dx) > Math.abs(dy)) {
      event.preventDefault();
      if (swipeEdge && dx > SWIPE_THRESHOLD) { sidebarOpen.set(true); swipeArmed = false; }
      else if ($sidebarOpen && dx < -SWIPE_THRESHOLD) { sidebarOpen.set(false); swipeArmed = false; }
    }
  }

  // preventDefault() inside a touchmove listener is a no-op unless the
  // listener itself is registered non-passive — svelte:window's ontouchmove
  // attribute doesn't guarantee that, so it's attached manually here instead.
  $effect(() => {
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => window.removeEventListener('touchmove', onTouchMove);
  });

  async function onTouchEnd() {
    if (pulling) {
      if (pullDistance >= PULL_THRESHOLD * 0.5) {
        refreshing = true;
        pullDistance = PULL_THRESHOLD * 0.6;
        await invalidateAll();
        refreshing = false;
      }
      pulling = false;
      pullDistance = 0;
    }
    pullArmed = false;
    swipeArmed = false;
  }
</script>

<svelte:window ontouchstart={onTouchStart} ontouchend={onTouchEnd} ontouchcancel={onTouchEnd} />

{#if pulling || refreshing}
  <div class="pull-indicator" style={`opacity:${Math.min(pullDistance / PULL_THRESHOLD, 1)}; transform:translate(-50%, ${Math.max(pullDistance - 30, 0)}px)`}>
    <span class="pull-spinner" class:spin={refreshing}></span>
  </div>
{/if}

<style>
  .pull-indicator {
    position: fixed;
    top: 8px;
    left: 50%;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--card);
    border: 1px solid var(--border);
    box-shadow: 0 8px 20px rgba(0,0,0,.35);
    pointer-events: none;
  }
  .pull-spinner {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 2px solid var(--border-hover);
    border-top-color: var(--accent);
  }
  .pull-spinner.spin {
    animation: pull-spin .6s linear infinite;
  }
  @keyframes pull-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pull-spinner.spin { animation: none; }
  }
</style>
