<script>
  import Icon from '$lib/components/Icon.svelte';
  import BankLogo from '$lib/components/BankLogo.svelte';
  import BrandLogo from '$lib/components/BrandLogo.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import ProgressTrack from '$lib/components/ProgressTrack.svelte';
  import TransactionFormModal from '$lib/components/TransactionFormModal.svelte';
  import CardPurchasesModal from '$lib/components/CardPurchasesModal.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import { selectedMonth, availableMonths, visibleTransactions as monthTransactions, visibleCreditCards, payCard } from '$lib/stores/finance.js';
  import { createModalHistory } from '$lib/modalHistory.js';

  // Was a plain snapshot of the clicked card ($state(null), assigned once
  // in open()) — after Register payment (or anything else) updated the
  // stores, this modal kept showing the exact object it opened with, so the
  // invoice/paid state never visibly changed until you closed and reopened
  // it. Deriving from the live store by id instead keeps it in sync with
  // whatever payCard/applyServerData just wrote.
  let selectedCardId = $state(null);
  const selectedCard = $derived(selectedCardId == null ? null : ($visibleCreditCards.find((c) => c.id === selectedCardId) ?? null));
  let detailTab = $state('overview');
  let detailsScrollEl = $state();
  const modalHistory = createModalHistory(() => { selectedCardId = null; });
  let modalRef;
  let purchasesModalRef;
  let confirmRef;

  async function confirmPayCard(card) {
    const ok = await confirmRef.ask({
      title: 'Register this payment?',
      message: `This records ${fmt(card.invoice)} as paid from ${card.account} — can't be undone from here, only by deleting the transaction afterwards.`,
      confirmLabel: 'Register payment'
    });
    if (ok) await payCard(card.id).catch((err) => alert(err.message));
  }

  const categoryVar = {
    Food: '--c-food', Grocery: '--c-grocery', Leisure: '--c-leisure', Car: '--c-car',
    Clothing: '--c-clothing', Services: '--c-services', Taxes: '--c-taxes', Bills: '--c-bills',
    Subscriptions: '--c-subs', Payments: '--c-payments', Others: '--c-others'
  };
  function categoryColor(category) { return `var(${categoryVar[category] || '--c-others'})`; }
  function categoryRanking(card) {
    const totals = {};
    $monthTransactions.filter((item) => item.type === 'card' && item.cardId === card.id).forEach((item) => {
      totals[item.category] = (totals[item.category] || 0) + item.amount;
    });
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
    return Object.entries(totals)
      .map(([category, amount]) => ({ category, amount, pct: total ? Math.round((amount / total) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }

  function fmt(n) { return 'R$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function openInvoice(card) { return card.paid ? 0 : card.invoice; }
  function isSettled(card) { return card.paid || card.invoice <= 0; }
  function usage(card) { return card.limit ? Math.min(100, Math.round((card.outstanding / card.limit) * 100)) : 0; }
  function monthDay(day, long = false) {
    const date = new Date(`${$selectedMonth}-${String(day).padStart(2, '0')}T12:00:00`);
    return long
      ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
  }
  function monthShort(monthStr) {
    return new Date(`${monthStr}-02T12:00:00`).toLocaleDateString('en-US', { month: 'short' });
  }
  function monthWithYear(monthStr) {
    return new Date(`${monthStr}-02T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  // `availableMonths` is the global horizon (other cards/fixed series can
  // stretch it out to Dec/2028) — a given card's own history should stop at
  // its last month with an actual invoice, not trail off in empty "Paid
  // R$0.00" rows for years nobody asked to see.
  function invoiceHistory(card) {
    let lastIndex = -1;
    availableMonths.forEach((month, i) => { if ((card.invoices[month] || 0) > 0) lastIndex = i; });
    const months = lastIndex >= 0 ? availableMonths.slice(0, lastIndex + 1) : availableMonths;
    return months.map((month) => {
      const amount = card.invoices[month] || 0;
      return { month, label: monthShort(month), amount, settled: card.paidMonths.includes(month) || amount <= 0 };
    });
  }
  export function open(card) {
    selectedCardId = card.id;
    detailTab = 'overview';
    modalHistory.opened();
  }
  function closeDetails() {
    selectedCardId = null;
    modalHistory.closed();
  }

  $effect(() => {
    if (detailTab === 'invoices' && detailsScrollEl) {
      requestAnimationFrame(() => {
        const openRow = detailsScrollEl.querySelector('.invoice-history-row.open-row');
        const target = openRow || detailsScrollEl.querySelector('.invoice-history')?.lastElementChild;
        if (target) {
          // offsetTop is relative to whatever positioned ancestor the row
          // happens to land on, not necessarily detailsScrollEl — the
          // section title/wrapper in between broke that assumption.
          // getBoundingClientRect diffs the actual rendered positions
          // instead, so it's correct regardless of the offsetParent chain.
          const containerTop = detailsScrollEl.getBoundingClientRect().top;
          const targetTop = target.getBoundingClientRect().top;
          detailsScrollEl.scrollTop = Math.max(0, detailsScrollEl.scrollTop + (targetTop - containerTop) - 8);
        }
      });
    } else if (detailsScrollEl) {
      detailsScrollEl.scrollTop = 0;
    }
  });

  $effect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && selectedCard) closeDetails();
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
  <button class="overlay" onclick={closeDetails} aria-label="Close details"></button>
  <div class="details-modal g-card">
    <div class="details-head">
      <BankLogo badge={selectedCard.badge} color={selectedCard.color} size={50} />
      <div class="details-title"><span class="eyebrow"><BrandLogo brand={selectedCard.brand} height={12} /> {selectedCard.brand} · {selectedCard.account}</span><h2>{selectedCard.name}</h2></div>
      <button class="icon-btn" onclick={closeDetails} aria-label="Close"><Icon name="close" size={18} /></button>
    </div>

    <button type="button" class="details-hero" onclick={() => purchasesModalRef.open(selectedCard, $selectedMonth)}>
      <div class="hero-top">
        <span>Current invoice</span>
        <StatusPill tone={isSettled(selectedCard) ? 'positive' : 'planned'}>{isSettled(selectedCard) ? 'Paid' : `Due ${monthDay(selectedCard.dueDay, true)}`}</StatusPill>
      </div>
      <strong class="money">{fmt(selectedCard.invoice)}</strong>
      <ProgressTrack percent={usage(selectedCard)} color={selectedCard.color} />
      <div class="hero-foot"><span>{usage(selectedCard)}% of {fmt(selectedCard.limit)}</span><span>{fmt(selectedCard.limit - selectedCard.outstanding)} available</span></div>
      <span class="hero-hint">View purchases <Icon name="chevronRight" size={13} /></span>
    </button>

    <div class="details-tabs" role="tablist">
      {#each [['overview', 'Overview'], ['invoices', 'Invoices']] as tab}
        <button class:active={detailTab === tab[0]} onclick={() => (detailTab = tab[0])}>{tab[1]}</button>
      {/each}
    </div>

    <div class="details-scroll" bind:this={detailsScrollEl}>
      {#if detailTab === 'overview'}
        <div class="detail-list"><div><span>Monthly limit</span><strong class="money">{fmt(selectedCard.limit)}</strong></div><div><span>Committed (open + next)</span><strong class="money">{fmt(openInvoice(selectedCard) + selectedCard.nextInvoice)}</strong></div><div><span>Next invoice</span><strong class="money">{fmt(selectedCard.nextInvoice)}</strong></div><div><span>Closes</span><strong>{monthDay(selectedCard.closureDay, true)}</strong></div><div><span>Payment due</span><strong>{monthDay(selectedCard.dueDay, true)}</strong></div></div>

        {#if categoryRanking(selectedCard).length}
          <div class="detail-section-title"><span>Category ranking</span><small>This month's invoice</small></div>
          <div class="ranking-list">
            {#each categoryRanking(selectedCard) as row}
              <div class="ranking-row">
                <div class="ranking-head"><span>{row.category}</span><strong class="money">{fmt(row.amount)}</strong></div>
                <div class="ranking-bar"><i style="width:{row.pct}%; background:{categoryColor(row.category)}"></i></div>
                <span class="ranking-pct">{row.pct}%</span>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="detail-section-title"><span>Invoice history</span><small>{invoiceHistory(selectedCard).length} months</small></div>
        <div class="invoice-history">
          {#each invoiceHistory(selectedCard) as row}
            <div class="invoice-history-row" class:current={row.month === $selectedMonth} class:open-row={!row.settled}>
              <span class="ih-month">{monthWithYear(row.month)}</span>
              <span class="ih-amount money">{fmt(row.amount)}</span>
              <span class="ih-status" class:paid={row.settled}>{row.settled ? 'Paid' : 'Open'}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="details-footer">
      {#if !isSettled(selectedCard)}<button class="pay-button" onclick={() => confirmPayCard(selectedCard)}><Icon name="check" size={17} /> Register payment</button>{/if}
      <button type="button" class="add-expense" onclick={() => modalRef.openAdd('card', { cardId: selectedCard.id })}>Add card expense</button>
    </div>
  </div>
{/if}

<TransactionFormModal bind:this={modalRef} />
<CardPurchasesModal bind:this={purchasesModalRef} />
<ConfirmModal bind:this={confirmRef} />

<style>
  .eyebrow {
    display: flex;
    align-items: center;
    gap: 5px;
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
  }
  .icon-btn:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .pay-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    border: 0;
    border-radius: 10px;
    padding: 10px 11px;
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 800;
    cursor: pointer;
  }
  .overlay {
    position: fixed;
    inset: 0;
    border: 0;
    background: rgba(4,5,10,.72);
    backdrop-filter: blur(3px);
    z-index: 50;
  }
  .details-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%,-50%);
    width: min(480px, calc(100% - 32px));
    height: min(760px, 90vh);
    z-index: 51;
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .details-head, .details-hero, .details-tabs, .details-footer {
    flex-shrink: 0;
  }
  .details-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
  .details-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .details-title {
    flex: 1;
    min-width: 0;
  }
  .details-title h2 {
    margin: 2px 0 0;
    font-size: 19px;
  }
  .details-hero {
    display: block;
    width: 100%;
    padding: 18px;
    border-radius: var(--radius);
    background: var(--accent-panel);
    border: 1px solid var(--border);
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color .15s;
  }
  .details-hero:hover {
    border-color: var(--accent);
  }
  .hero-hint {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: 11px;
    padding-top: 11px;
    border-top: 1px solid var(--border-soft);
    color: var(--accent);
    font-size: 10.5px;
    font-weight: 800;
  }
  .hero-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .hero-top span:first-child {
    color: var(--muted);
    font-size: 11px;
  }
  .details-hero strong {
    display: block;
    font-size: 30px;
    margin: 6px 0 12px;
  }
  .hero-foot {
    display: flex;
    justify-content: space-between;
    margin-top: 9px;
    color: var(--muted);
    font-size: 10.5px;
  }
  .details-tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    padding: 4px;
    border-radius: 11px;
    background: var(--panel);
  }
  .details-tabs button {
    padding: 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }
  .details-tabs button.active {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .invoice-history {
    margin-top: 8px;
  }
  .invoice-history-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 12px;
    padding: 12px 2px;
    border-bottom: 1px solid var(--border-soft);
    font-size: 13px;
  }
  .invoice-history-row.current {
    color: var(--text);
    font-weight: 700;
  }
  .ih-month {
    color: var(--muted);
  }
  .invoice-history-row.current .ih-month {
    color: var(--text);
  }
  .ih-status {
    padding: 3px 8px;
    border-radius: 99px;
    background: rgba(245, 158, 11, 0.16);
    color: var(--planned);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .ih-status.paid {
    background: var(--positive-soft);
    color: var(--positive);
  }
  .detail-section-title {
    display: flex;
    align-items: end;
    justify-content: space-between;
    padding: 0 2px;
  }
  .detail-section-title span {
    font-size: 12px;
    font-weight: 800;
  }
  .detail-section-title small {
    color: var(--muted);
    font-size: 10px;
  }
  .detail-list {
    margin-top: 8px;
  }
  .detail-list div {
    display: flex;
    justify-content: space-between;
    padding: 12px 2px;
    border-bottom: 1px solid var(--border-soft);
    font-size: 13px;
  }
  .detail-list span {
    color: var(--muted);
  }
  .ranking-list {
    margin-top: 8px;
  }
  .ranking-row {
    padding: 9px 2px;
    border-bottom: 1px solid var(--border-soft);
  }
  .ranking-row:last-child {
    border-bottom: 0;
  }
  .ranking-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 5px;
    font-size: 12px;
  }
  .ranking-head span {
    font-weight: 700;
  }
  .ranking-head strong {
    font-size: 12.5px;
  }
  .ranking-bar {
    position: relative;
    height: 5px;
    border-radius: 99px;
    background: var(--panel);
    overflow: hidden;
  }
  .ranking-bar i {
    display: block;
    height: 100%;
    border-radius: 99px;
  }
  .ranking-pct {
    display: block;
    margin-top: 3px;
    color: var(--faint);
    font-size: 9.5px;
    font-weight: 700;
  }
  .add-expense {
    display: block;
    width: 100%;
    margin-top: 20px;
    padding: 12px;
    border: 0;
    border-radius: 11px;
    background: var(--accent-solid);
    color: var(--bg);
    text-decoration: none;
    text-align: center;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }
  .details-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .details-footer .pay-button, .details-footer .add-expense {
    margin: 0;
  }
  @media (max-width: 900px) {
    .pay-button {
      padding: 8px 9px;
      font-size: 11px;
    }
    .details-modal {
      width: min(420px, calc(100% - 24px));
      padding: 18px;
    }
  }
</style>
