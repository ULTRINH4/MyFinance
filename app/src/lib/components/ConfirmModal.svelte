<script>
  import Icon from '$lib/components/Icon.svelte';
  import { createModalHistory } from '$lib/modalHistory.js';

  let open = $state(false);
  let title = $state('Are you sure?');
  let message = $state('');
  let confirmLabel = $state('Delete');
  let resolvePromise;
  const modalHistory = createModalHistory(() => decide(false));

  export function ask({ title: t, message: m, confirmLabel: c } = {}) {
    title = t || 'Are you sure?';
    message = m || '';
    confirmLabel = c || 'Delete';
    open = true;
    modalHistory.opened();
    return new Promise((resolve) => { resolvePromise = resolve; });
  }

  function decide(value) {
    if (!open) return;
    open = false;
    modalHistory.closed();
    resolvePromise?.(value);
  }
</script>

{#if open}
  <button class="overlay" onclick={() => decide(false)} aria-label="Close confirmation"></button>
  <aside class="confirm-card" role="alertdialog" aria-modal="true" aria-label={title}>
    <div class="confirm-icon"><Icon name="close" size={18} /></div>
    <h3>{title}</h3>
    {#if message}<p>{message}</p>{/if}
    <div class="confirm-actions">
      <button type="button" class="cancel-button" onclick={() => decide(false)}>Cancel</button>
      <button type="button" class="confirm-button" onclick={() => decide(true)}>{confirmLabel}</button>
    </div>
  </aside>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    border: 0;
    background: rgba(4,5,10,.72);
    backdrop-filter: blur(3px);
    z-index: 60;
  }
  .confirm-card {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%,-50%);
    width: min(360px,calc(100% - 32px));
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    z-index: 61;
    padding: 22px;
    text-align: center;
  }
  .confirm-icon {
    display: flex;
    width: 40px;
    height: 40px;
    margin: 0 auto 12px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--negative-soft);
    color: var(--negative);
  }
  .confirm-card h3 {
    margin: 0 0 6px;
    font-size: 15px;
  }
  .confirm-card p {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .confirm-actions {
    display: flex;
    gap: 8px;
    margin-top: 18px;
  }
  .confirm-actions button {
    flex: 1;
    border-radius: 10px;
    padding: 10px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }
  .cancel-button {
    border: 1px solid var(--border-soft);
    background: transparent;
    color: var(--text);
  }
  .cancel-button:hover {
    border-color: var(--border-hover);
    background: var(--card-hover);
  }
  .confirm-button {
    border: 1px solid var(--negative);
    background: var(--negative-soft);
    color: var(--negative);
  }
  .confirm-button:hover {
    background: var(--negative);
    color: var(--bg);
  }
</style>
