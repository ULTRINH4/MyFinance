<script>
  import Icon from './Icon.svelte';
  import { privateMode } from '$lib/stores/privateMode.js';
  import {
    availableMonths, selectedMonth, visibleCreditCards, transactionSummary,
    debugSetPending, debugAddSample, debugSetCardInvoice, debugSetAllPaid, debugResetFinance
  } from '$lib/stores/finance.js';

  // Painel só existe em dev (import.meta.env.DEV é eliminado no build de produção).
  // Aparência (accent, radius, sidebar width, motion) é responsabilidade só de
  // /settings agora — ver $lib/data/appearance.js. O painel em si só é aberto
  // a partir de /settings (ver open() exportado), não flutua em nenhuma página.

  let open = $state(false);

  export function openPanel() {
    open = true;
  }

  function pendingInput(type, event) {
    debugSetPending(type, event.currentTarget.value);
  }

  $effect(() => {
    if (!open) return;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') open = false;
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });
</script>

{#if open}
  <button class="dbg-overlay" onclick={() => (open = false)} aria-label="Close"></button>
  <div class="dbg-panel">
    <div class="dbg-head">
      <div class="dbg-title"><Icon name="flask" size={16} /><span>Debug</span><span class="dbg-tag">dev only</span></div>
      <button class="dbg-close" onclick={() => (open = false)}><Icon name="close" size={15} /></button>
    </div>

    <div class="dbg-section">
      <div class="dbg-lbl">Active month</div>
      <select class="dbg-select" value={$selectedMonth} onchange={(event) => selectedMonth.set(event.currentTarget.value)}>
        {#each availableMonths as month}<option value={month}>{month}</option>{/each}
      </select>
    </div>

    <div class="dbg-section">
      <div class="dbg-lbl">Privacy</div>
      <button class="dbg-wide" class:on={$privateMode} onclick={() => privateMode.update((value) => !value)}>
        Private mode: {$privateMode ? 'on' : 'off'}
      </button>
    </div>

    <div class="dbg-section">
      <div class="dbg-lbl">Pending values</div>
      <label class="dbg-field"><span>Expense</span><input type="number" min="0" step="10" value={$transactionSummary.expenses.pending} onchange={(event) => pendingInput('expense', event)} /></label>
      <label class="dbg-field"><span>Income</span><input type="number" min="0" step="10" value={$transactionSummary.incomes.pending} onchange={(event) => pendingInput('income', event)} /></label>
      <button class="dbg-wide" onclick={debugSetAllPaid}>Mark month as fully paid</button>
    </div>

    <div class="dbg-section">
      <div class="dbg-lbl">Add sample transaction</div>
      <div class="dbg-grid">
        <button onclick={() => debugAddSample('expense')}>Expense</button>
        <button onclick={() => debugAddSample('card')}>Card expense</button>
        <button onclick={() => debugAddSample('income')}>Income</button>
        <button onclick={() => debugAddSample('transfer')}>Transfer</button>
      </div>
    </div>

    <div class="dbg-section">
      <div class="dbg-lbl">Card invoices</div>
      {#each $visibleCreditCards as card}
        <label class="dbg-field"><span>{card.name}</span><input type="number" min="0" step="50" value={card.invoice} onchange={(event) => debugSetCardInvoice(card.id, event.currentTarget.value)} /></label>
      {/each}
    </div>

    <button class="dbg-reset danger" onclick={debugResetFinance}>Reset test data</button>
  </div>
{/if}

<style>
  .dbg-overlay {
    position: fixed;
    inset: 0;
    background: rgba(4, 5, 10, 0.55);
    backdrop-filter: blur(2px);
    border: none;
    z-index: 201;
  }
  .dbg-panel {
    position: fixed;
    right: 20px;
    bottom: 76px;
    width: min(360px, calc(100vw - 40px));
    max-height: 76vh;
    overflow-y: auto;
    background: var(--panel-strong);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 14px;
    padding: 14px;
    z-index: 202;
    backdrop-filter: blur(16px) saturate(140%);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  }
  .dbg-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .dbg-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-weight: 800;
    font-size: 13.5px;
    color: #fbbf24;
  }
  .dbg-tag {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--faint);
    background: var(--panel);
    padding: 2px 6px;
    border-radius: 999px;
  }
  .dbg-close {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 4px;
  }
  .dbg-section {
    margin-bottom: 14px;
  }
  .dbg-lbl {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 7px;
  }
  .dbg-reset {
    width: 100%;
    padding: 8px;
    border-radius: 9px;
    border: 1px solid var(--border-soft);
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .dbg-reset:hover {
    color: var(--text);
    border-color: var(--border-hover);
  }
  .dbg-select,
  .dbg-field input {
    width: 100%;
    padding: 8px 9px;
    border: 1px solid var(--border-soft);
    border-radius: 8px;
    background: var(--panel);
    color: var(--text);
    font-size: 12px;
  }
  .dbg-field {
    display: grid;
    grid-template-columns: 1fr 110px;
    align-items: center;
    gap: 8px;
    margin-bottom: 7px;
    color: var(--muted);
    font-size: 11px;
  }
  .dbg-wide,
  .dbg-grid button {
    padding: 8px 9px;
    border: 1px solid var(--border-soft);
    border-radius: 8px;
    background: var(--panel);
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .dbg-wide {
    width: 100%;
  }
  .dbg-wide.on {
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.45);
  }
  .dbg-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
  }
  .dbg-grid button:hover,
  .dbg-wide:hover {
    color: var(--text);
    border-color: var(--border-hover);
  }
  .dbg-reset.danger {
    color: var(--negative);
    border-color: rgba(251, 113, 133, 0.25);
  }
  @media (max-width: 900px) {
    .dbg-panel {
      top: 62px;
      right: 10px;
      bottom: auto;
      width: min(360px, calc(100vw - 20px));
      max-height: calc(100vh - 76px);
    }
  }
</style>
