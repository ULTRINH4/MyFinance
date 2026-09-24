<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import BankLogo from '$lib/components/BankLogo.svelte';
  import BrandLogo from '$lib/components/BrandLogo.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import ProgressTrack from '$lib/components/ProgressTrack.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import TransactionFormModal from '$lib/components/TransactionFormModal.svelte';
  import CardDetailsModal from '$lib/components/CardDetailsModal.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar.js';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { visibleCreditCards, cardTotals, selectedMonth, monthLabel, changeMonth, payCard, currentMonth } from '$lib/stores/finance.js';

  let modalRef;
  let cardModalRef;
  let confirmRef;

  // Same "Register payment" action as CardDetailsModal, just triggered from
  // the card tile directly instead of opening details first — needs its own
  // confirmation for the same reason (real money, can't undo from the UI).
  async function confirmPayCard(card) {
    const ok = await confirmRef.ask({
      title: 'Register this payment?',
      message: `This records ${fmt(card.invoice)} as paid from ${card.account} — can't be undone from here, only by deleting the transaction afterwards.`,
      confirmLabel: 'Register payment'
    });
    if (ok) await payCard(card.id).catch((err) => alert(err.message));
  }
  const backHref = $page.url.searchParams.get('from') === 'summary' ? '/' : null;

  $effect(() => {
    const requestedId = $page.url.searchParams.get('card');
    if (!requestedId) return;
    const match = $visibleCreditCards.find((card) => card.id === requestedId);
    if (match) cardModalRef.open(match);
    goto('/credit-cards', { replaceState: true, keepFocus: true, noScroll: true });
  });
  function fmt(n) { return 'R$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function openInvoice(card) { return card.paid ? 0 : card.invoice; }
  function isSettled(card) { return card.paid || card.invoice <= 0; }
  function usage(card) { return card.limit ? Math.min(100, Math.round((card.outstanding / card.limit) * 100)) : 0; }
  function totalLimit() { return $visibleCreditCards.reduce((sum, card) => sum + card.limit, 0); }
  function totalOpen() { return $visibleCreditCards.reduce((sum, card) => sum + card.outstanding, 0); }
  function monthDay(day, long = false) {
    const date = new Date(`${$selectedMonth}-${String(day).padStart(2, '0')}T12:00:00`);
    return long
      ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
  }
</script>

<svelte:head><title>Credit cards · MyFinance</title></svelte:head>

<PageHeader eyebrow={$monthLabel} title="Credit cards" backHref={backHref} stackedActions>
  <div class="header-actions">
    <div class="month-nav">
      <button class="icon-btn" onclick={() => changeMonth(-1)} aria-label="Previous month"><Icon name="chevronLeft" size={15} /></button>
      <button class="month-label" onclick={() => selectedMonth.set(currentMonth())} disabled={$selectedMonth === currentMonth()} title="Back to current month">{$monthLabel}</button>
      <button class="icon-btn" onclick={() => changeMonth(1)} aria-label="Next month"><Icon name="chevronRight" size={15} /></button>
    </div>
    <button class="icon-btn" class:on={$privateMode} onclick={() => privateMode.update((v) => !v)} aria-label="Private mode"><Icon name="eye" size={18} /></button>
  </div>
</PageHeader>

<main class="page-content">
  <section class="summary-strip g-card">
    <div class="summary-item primary"><span class="summary-icon"><Icon name="clock" size={16} /></span><span class="summary-copy"><small>Outstanding</small><strong class="money">{fmt(totalOpen())}</strong></span></div>
    <div class="summary-item next"><span class="summary-icon"><Icon name="calendar" size={16} /></span><span class="summary-copy"><small>Next invoices</small><strong class="money">{fmt($cardTotals.next)}</strong></span></div>
    <div class="summary-item available"><span class="summary-icon"><Icon name="card" size={16} /></span><span class="summary-copy"><small>Available limit</small><strong class="money">{fmt(totalLimit() - totalOpen())}</strong></span></div>
    <div class="summary-item cards"><span class="summary-icon"><Icon name="list" size={16} /></span><span class="summary-copy"><small>Open cards</small><strong>{$visibleCreditCards.filter((card) => openInvoice(card) > 0).length} <em>of {$visibleCreditCards.length}</em></strong></span></div>
  </section>

  <div class="cards-grid">
    {#each $visibleCreditCards as card (card.id)}
      <div
        class="credit-card g-card"
        role="button"
        tabindex="0"
        onclick={() => cardModalRef.open(card)}
        onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); cardModalRef.open(card); } }}
      >
        <div class="card-head">
          <BankLogo badge={card.badge} color={card.color} size={42} />
          <div class="card-name"><h2>{card.name}</h2><span><BrandLogo brand={card.brand} height={12} /> {card.brand} · {card.account}</span></div>
          <StatusPill tone={isSettled(card) ? 'positive' : 'planned'}>{isSettled(card) ? 'Paid' : `Due ${monthDay(card.dueDay)}`}</StatusPill>
        </div>

        <div class="limit-row"><div><span>Limit</span><strong class="money">{fmt(card.limit)}</strong></div><div><span>Committed</span><strong class="money">{fmt(openInvoice(card) + card.nextInvoice)}</strong></div><div><span>Available</span><strong class="available money">{fmt(card.limit - card.outstanding)}</strong></div></div>
        <div class="usage-head"><span>Limit usage</span><strong>{usage(card)}%</strong></div>
        <ProgressTrack percent={usage(card)} color={card.color} style="margin-top:7px;" />

        <div class="dates"><div><span>Closing</span><strong>{monthDay(card.closureDay)}</strong></div><div><span>Due date</span><strong>{monthDay(card.dueDay)}</strong></div><div><span>Next invoice</span><strong class="money">{fmt(card.nextInvoice)}</strong></div></div>
        <div class="invoice-total"><span>Current invoice</span><strong class="money">{fmt(card.invoice)}</strong></div>
        <div class="card-actions">
          {#if !isSettled(card)}<button class="pay-button" onclick={(event) => { event.stopPropagation(); confirmPayCard(card); }}><Icon name="check" size={17} /> Register payment</button>{:else}<span class="paid-note"><Icon name="check" size={15} /> Invoice settled</span>{/if}
        </div>
      </div>
    {/each}
  </div>
</main>

<button type="button" class="mobile-fab" onclick={() => modalRef.openAdd('card')} aria-label="Add card expense">+</button>

<CardDetailsModal bind:this={cardModalRef} />
<TransactionFormModal bind:this={modalRef} />
<ConfirmModal bind:this={confirmRef} />

<style>
.page-content {
  width: min(1120px,100%);
  margin: 0 auto;
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
.icon-btn:hover, .icon-btn.on {
  background: var(--accent-soft);
  color: var(--accent);
}
.page-content {
  padding: 0 28px 50px;
}
.summary-strip {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  margin-bottom: 16px;
  overflow: hidden;
}
.cards-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 16px;
}
.credit-card {
  padding: 18px;
  cursor: pointer;
  transition: border-color var(--motion-duration), background var(--motion-duration);
}
.credit-card:hover {
  border-color: var(--border-hover);
  background: var(--card-hover);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 11px;
}
.card-name {
  flex: 1;
  min-width: 0;
}
.card-name h2 {
  margin: 0;
  font-size: 16px;
}
.card-name span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
}
.limit-row, .usage-head, .invoice-total {
  display: flex;
  justify-content: space-between;
}
.limit-row {
  margin-top: 20px;
}
.limit-row div:nth-child(2) {
  text-align: center;
}
.limit-row div:last-child {
  text-align: right;
}
.limit-row span, .usage-head span, .dates span, .invoice-total span {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.limit-row strong {
  font-size: 13px;
}
.limit-row .available {
  color: var(--positive);
}
.usage-head {
  margin-top: 16px;
  font-size: 10px;
  color: var(--muted);
}
.usage-head strong {
  color: var(--text);
}
.dates {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 10px;
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid var(--border-soft);
}
.dates div:nth-child(2) {
  text-align: center;
}
.dates div:last-child {
  text-align: right;
}
.dates strong {
  font-size: 11px;
}
.invoice-total {
  align-items: end;
  margin-top: 19px;
}
.invoice-total strong {
  font-size: 23px;
}
.card-actions {
  display: flex;
  align-items: center;
  margin-top: 16px;
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
.paid-note {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--positive);
  font-size: 11px;
  font-weight: 700;
}
.mobile-fab {
  display: none;
}
.summary-strip {
  gap: 6px;
  padding: 6px;
  background: linear-gradient(135deg,var(--panel),color-mix(in srgb,var(--accent-panel) 30%,var(--panel)));
}
.summary-strip .summary-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border: 0;
  border-radius: 11px;
}
.summary-strip .summary-item.primary {
  background: var(--accent-soft);
}
.summary-icon {
  width: 31px;
  height: 31px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 9px;
  background: var(--panel-strong);
  color: var(--muted);
}
.summary-item.primary .summary-icon {
  background: var(--accent-panel);
  color: var(--accent);
}
.summary-item.available .summary-icon {
  background: var(--positive-soft);
  color: var(--positive);
}
.summary-copy {
  min-width: 0;
}
.summary-strip .summary-copy small {
  display: block;
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 9px;
}
.summary-strip .summary-copy strong {
  display: block;
  font-size: 14px;
}
.summary-copy em {
  color: var(--muted);
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
}
@media(max-width:900px) {
  .month-nav {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
  }
  .page-content {
    padding: 0 8px 90px;
  }
  .cards-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .summary-strip {
    grid-template-columns: 1fr 1fr;
    margin-bottom: 10px;
  }
  .summary-strip .summary-item {
    padding: 9px;
  }
  .summary-strip .summary-item:nth-child(3), .summary-strip .summary-item:last-child {
    display: none;
  }
  .credit-card {
    padding: 13px;
  }
  .card-name h2 {
    font-size: 15px;
  }
  .limit-row {
    margin-top: 14px;
  }
  .limit-row strong {
    font-size: 11px;
  }
  .usage-head {
    margin-top: 11px;
  }
  .dates {
    margin-top: 13px;
    padding-top: 11px;
  }
  .invoice-total {
    margin-top: 13px;
  }
  .invoice-total strong {
    font-size: 20px;
  }
  .card-actions {
    margin-top: 11px;
  }
  .pay-button {
    padding: 8px 9px;
    font-size: 11px;
  }
  .mobile-fab {
    display: flex;
    position: fixed;
    right: 18px;
    bottom: 20px;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border: 0;
    border-radius: 18px;
    background: var(--accent-solid);
    color: var(--bg);
    font: inherit;
    font-size: 30px;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 12px 32px rgba(0,0,0,.45);
  }
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.month-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.month-label {
  width: 100px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 8px;
}
.month-label:not(:disabled):hover {
  color: var(--accent);
}
.month-label:disabled {
  cursor: default;
}
@media(min-width:901px) {
  :global(.page-header) {
    padding-top: 18px;
    padding-bottom: 14px;
  }
  .page-content {
    padding-bottom: 18px;
  }
  .summary-strip {
    margin-bottom: 12px;
  }
  .summary-strip div {
    padding: 11px 16px;
  }
  .cards-grid {
    gap: 12px;
  }
  .credit-card {
    padding: 15px;
  }
  .limit-row {
    margin-top: 14px;
  }
  .usage-head {
    margin-top: 11px;
  }
  .dates {
    margin-top: 12px;
    padding-top: 10px;
  }
  .invoice-total {
    margin-top: 12px;
  }
  .card-actions {
    margin-top: 10px;
  }
}
</style>
