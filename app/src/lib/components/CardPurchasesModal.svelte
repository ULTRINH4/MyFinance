<script>
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import BankLogo from '$lib/components/BankLogo.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import { transactions, availableMonths, selectedMonth as globalMonth } from '$lib/stores/finance.js';
  import { createModalHistory } from '$lib/modalHistory.js';

  let selectedCard = $state(null);
  let viewMonth = $state('');
  const modalHistory = createModalHistory(() => { selectedCard = null; });

  function fmt(n) { return 'R$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  const monthLabel = $derived(viewMonth ? new Date(`${viewMonth}-02T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '');
  const purchases = $derived(selectedCard
    ? $transactions.filter((t) => t.type === 'card' && t.cardId === selectedCard.id && t.dueDate.startsWith(viewMonth)).sort((a, b) => b.date.localeCompare(a.date))
    : []);
  const invoiceTotal = $derived(purchases.reduce((sum, item) => sum + item.amount, 0));
  const isPaid = $derived(selectedCard ? (selectedCard.paidMonths || []).includes(viewMonth) || invoiceTotal <= 0 : false);

  export function open(card, month) {
    selectedCard = card;
    viewMonth = month || get(globalMonth);
    modalHistory.opened();
  }
  function close() {
    selectedCard = null;
    modalHistory.closed();
  }
  function changeMonth(step) {
    const idx = availableMonths.indexOf(viewMonth);
    if (idx === -1) return;
    const next = availableMonths[Math.max(0, Math.min(availableMonths.length - 1, idx + step))];
    if (next) viewMonth = next;
  }
  function openStatement() {
    // Don't route through close()/modalHistory.closed() here — it fires a
    // history.back() that races the goto() below and can swallow the
    // navigation (button appeared to do nothing). We're leaving this route
    // entirely, so just drop the local modal state.
    const cardId = selectedCard.id;
    selectedCard = null;
    goto(`/transactions?type=statement&cardId=${cardId}`);
  }

  $effect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && selectedCard) close();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });

  $effect(() => {
    if (selectedCard) {
      const scrollY = window.scrollY;
      const body = document.body;
      const previous = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow };
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      return () => {
        body.style.position = previous.position;
        body.style.top = previous.top;
        body.style.left = previous.left;
        body.style.right = previous.right;
        body.style.width = previous.width;
        body.style.overflow = previous.overflow;
        window.scrollTo(0, scrollY);
      };
    }
  });
</script>

{#if selectedCard}
  <button class="overlay" onclick={close} aria-label="Close purchases"></button>
  <div class="purchases-modal g-card" role="dialog" aria-label="Card purchases">
    <div class="purchases-head">
      <BankLogo badge={selectedCard.badge} color={selectedCard.color} size={44} />
      <div class="purchases-title"><span class="eyebrow">{selectedCard.name}</span><h2>Purchases</h2></div>
      <button class="icon-btn" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    </div>

    <div class="month-switch">
      <button class="icon-btn" onclick={() => changeMonth(-1)} aria-label="Previous month"><Icon name="chevronLeft" size={15} /></button>
      <strong>{monthLabel}</strong>
      <button class="icon-btn" onclick={() => changeMonth(1)} aria-label="Next month"><Icon name="chevronRight" size={15} /></button>
    </div>

    <div class="purchases-summary">
      <div><span>Invoice total</span><strong class="money">{fmt(invoiceTotal)}</strong></div>
      <div class="summary-actions">
        <StatusPill tone={isPaid ? 'positive' : 'planned'}>{isPaid ? 'Paid' : 'Open'}</StatusPill>
        <button class="statement-btn" type="button" onclick={openStatement}>Edit in Statement <Icon name="chevronRight" size={13} /></button>
      </div>
    </div>

    <div class="purchases-list">
      {#each purchases as item (item.id)}
        <div class="purchase-row">
          <div class="purchase-main">
            <div class="purchase-name">{#if item.installmentTotal > 1}<span class="installment-pill">{item.installmentNumber}/{item.installmentTotal}</span>{/if}{item.local}</div>
            <span class="purchase-category">{item.category}</span>
          </div>
          <div class="purchase-side">
            <time>{new Date(`${item.entryDate || item.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</time>
            <strong class="money">{fmt(item.amount)}</strong>
          </div>
        </div>
      {:else}
        <div class="empty"><Icon name="search" size={20} /><span>No purchases this month</span></div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .eyebrow {
    color: var(--accent);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .09em;
    text-transform: uppercase;
  }
  .icon-btn {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .icon-btn:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .overlay {
    position: fixed;
    inset: 0;
    border: 0;
    background: rgba(4,5,10,.72);
    backdrop-filter: blur(3px);
    z-index: 52;
  }
  .purchases-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%,-50%);
    display: flex;
    flex-direction: column;
    width: min(480px, calc(100% - 32px));
    height: min(640px, 86vh);
    z-index: 53;
    padding: 22px;
  }
  .purchases-head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .purchases-title {
    flex: 1;
    min-width: 0;
  }
  .purchases-title h2 {
    margin: 2px 0 0;
    font-size: 19px;
  }
  .month-switch {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 18px 0 0;
    flex-shrink: 0;
  }
  .month-switch strong {
    min-width: 150px;
    text-align: center;
    font-size: 13px;
  }
  .purchases-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 14px;
    padding: 14px;
    border-radius: var(--radius);
    background: var(--accent-panel);
    border: 1px solid var(--border);
    flex-shrink: 0;
  }
  .purchases-summary span {
    display: block;
    color: var(--muted);
    font-size: 10.5px;
  }
  .purchases-summary strong {
    display: block;
    margin-top: 3px;
    font-size: 20px;
  }
  .summary-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .statement-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--panel-strong);
    color: var(--accent);
    padding: 7px 10px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }
  .statement-btn:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .purchases-list {
    flex: 1;
    min-height: 0;
    margin-top: 10px;
    padding-right: 6px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-hover) transparent;
  }
  .purchases-list::-webkit-scrollbar {
    width: 6px;
  }
  .purchases-list::-webkit-scrollbar-track {
    background: transparent;
  }
  .purchases-list::-webkit-scrollbar-thumb {
    background: var(--border-hover);
    border-radius: 99px;
  }
  .purchases-list::-webkit-scrollbar-thumb:hover {
    background: var(--muted);
  }
  .purchase-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 2px;
    border-bottom: 1px solid var(--border-soft);
  }
  .purchase-row:last-child {
    border-bottom: 0;
  }
  .purchase-main {
    flex: 1;
    min-width: 0;
  }
  .purchase-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .installment-pill {
    flex-shrink: 0;
    padding: 2px 6px;
    border-radius: 99px;
    background: var(--panel-strong);
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .purchase-category {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: 10.5px;
  }
  .purchase-side {
    text-align: right;
    flex-shrink: 0;
  }
  .purchase-side time {
    display: block;
    color: var(--faint);
    font-size: 9.5px;
    text-transform: uppercase;
  }
  .purchase-side strong {
    display: block;
    margin-top: 2px;
    font-size: 13px;
  }
  .empty {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 6px;
    padding: 36px 20px;
    color: var(--muted);
    font-size: 12px;
  }
  @media (max-width: 900px) {
    .purchases-modal {
      width: min(420px, calc(100% - 24px));
      padding: 18px;
    }
  }
</style>
