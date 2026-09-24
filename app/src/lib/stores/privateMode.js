import { writable } from 'svelte/store';

// Wraps a plain writable so every existing call site (privateMode.set/update
// across pages + DebugPanel) keeps working unchanged, while changes after
// hydrate() also persist to the user's row via /api/private-mode.
function createPrivateModeStore() {
  const { subscribe, set, update } = writable(false);
  let persist = false;

  subscribe((enabled) => {
    if (!persist) return;
    fetch('/api/private-mode', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled })
    }).catch(() => {});
  });

  return {
    subscribe,
    set,
    update,
    // Sets the initial value from the server-loaded user without triggering
    // a redundant persist call for the value that just came from the DB.
    hydrate(enabled) {
      persist = false;
      set(Boolean(enabled));
      persist = true;
    }
  };
}

export const privateMode = createPrivateModeStore();
