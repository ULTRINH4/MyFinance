<script>
  import { page } from '$app/stores';
  import Icon from '$lib/components/Icon.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import TransactionFormModal from '$lib/components/TransactionFormModal.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { showCardTransactions } from '$lib/stores/settings.js';
  import { visibleTransactions as monthTransactions, visibleCreditCards, pendingCardInvoices, selectedMonth, monthLabel, changeMonth, toggleTransactionStatus, deleteTransaction, isSpendingTransaction, payCard, currentMonth } from '$lib/stores/finance.js';

  let activeType = $state($page.url.searchParams.get('type') || 'expense');
  let statusFilter = $state($page.url.searchParams.get('status') || 'all');
  let search = $state($page.url.searchParams.get('q') || '');
  // Exact-match filters for links that navigate here from a specific
  // category/subcategory/account (Categories, Summary's donut, Accounts) —
  // `q` alone can't express this safely: it's a substring search over the
  // combined "Category · Subcategory" text, so a bare subcategory name like
  // "Others" (nearly every category has one) or an account name that's a
  // prefix of another (e.g. "Main Account" / "Fixed Income") pulls in
  // unrelated rows. These three match the real field exactly instead.
  let categoryFilter = $state($page.url.searchParams.get('category') || '');
  let subcategoryFilter = $state($page.url.searchParams.get('subcategory') || '');
  let accountFilter = $state($page.url.searchParams.get('account') || '');
  const cardFilterParam = $page.url.searchParams.get('cardId');
  let cardFilter = $state(cardFilterParam ? Number(cardFilterParam) : null);
  const activeFilterChips = $derived([
    categoryFilter && subcategoryFilter
      ? { label: `${categoryFilter} · ${subcategoryFilter}`, clear: () => { categoryFilter = ''; subcategoryFilter = ''; } }
      : categoryFilter ? { label: categoryFilter, clear: () => (categoryFilter = '') } : null,
    accountFilter ? { label: accountFilter, clear: () => (accountFilter = '') } : null,
    cardFilter ? { label: cardName(cardFilter), clear: () => (cardFilter = null) } : null
  ].filter(Boolean));
  const catOf = (t) => t.category.split('·')[0].trim();
  const subOf = (t) => t.category.split('·')[1]?.trim() || '';
  const requestedType = $page.url.searchParams.get('add');
  const fromParam = $page.url.searchParams.get('from');
  const backHref = fromParam === 'summary' ? '/' : fromParam === 'categories' ? '/categories' : null;

  let modalRef = $state();
  let confirmRef = $state();
  $effect(() => {
    if (requestedType && modalRef) modalRef.openAdd(requestedType);
  });


  let detailsOpen = $state(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function detailsData() {
    const items = [...$monthTransactions, ...$pendingCardInvoices].filter((item) => isSpendingTransaction(item) || item.invoiceRecord);
    const records = items.length;
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const cardSpend = items.filter((item) => item.type === 'card' || item.invoiceRecord).reduce((sum, item) => sum + item.amount, 0);
    const accountDebit = total - cardSpend;

    const situation = { paid: 0, paidCount: 0, overdue: 0, overdueCount: 0, dueSoon: 0, dueSoonCount: 0, upcoming: 0, upcomingCount: 0 };
    const recurrence = { fixed: 0, fixedCount: 0, installments: 0, installmentsCount: 0, variable: 0, variableCount: 0 };
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const byWeekday = weekdayNames.map((label) => ({ label, total: 0, count: 0 }));

    items.forEach((item) => {
      if (item.status === 'paid') {
        situation.paid += item.amount;
        situation.paidCount++;
      } else {
        const due = new Date(`${item.dueDate}T12:00:00`);
        const diffDays = Math.round((due - today) / 86400000);
        if (diffDays < 0) { situation.overdue += item.amount; situation.overdueCount++; }
        else if (diffDays <= 3) { situation.dueSoon += item.amount; situation.dueSoonCount++; }
        else { situation.upcoming += item.amount; situation.upcomingCount++; }
      }

      const isInstallment = item.recurrence === 'repeat' || (item.installmentTotal && Number(item.installmentTotal) > 1);
      const isFixed = item.recurrence === 'fixed' || (!item.recurrence && item.recurring);
      if (isInstallment) { recurrence.installments += item.amount; recurrence.installmentsCount++; }
      else if (isFixed) { recurrence.fixed += item.amount; recurrence.fixedCount++; }
      else { recurrence.variable += item.amount; recurrence.variableCount++; }

      const day = new Date(`${item.dueDate}T12:00:00`).getDay();
      byWeekday[day].total += item.amount;
      byWeekday[day].count += 1;
    });

    const weekdaysTotal = byWeekday.slice(1, 6).reduce((sum, d) => sum + d.total, 0);
    const weekendTotal = byWeekday[0].total + byWeekday[6].total;

    return { records, total, cardSpend, accountDebit, situation, recurrence, byWeekday, weekdaysTotal, weekendTotal };
  }

  $effect(() => {
    if (detailsOpen) {
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

  $effect(() => {
    document.body.classList.add('transactions-page');
    return () => document.body.classList.remove('transactions-page');
  });

  function fmt(n) {
    const sign = n < 0 ? '-' : '';
    return sign + 'R$ ' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function visibleTransactions() {
    const term = search.trim().toLowerCase();
    return [...$monthTransactions, ...$pendingCardInvoices].filter((item) => {
      const typeMatches = activeType === 'statement' || (activeType === 'expense' ? item.type === 'expense' || ($showCardTransactions && item.type === 'card') || item.invoiceRecord || item.cardPayment : item.type === activeType);
      const statusMatches = statusFilter === 'all' || item.status === statusFilter;
      const itemsText = (item.items || []).map((i) => i.description).join(' ');
      const searchMatches = !term || `${item.local} ${item.category} ${item.account} ${item.amount} ${itemsText}`.toLowerCase().includes(term);
      const categoryMatches = !categoryFilter || catOf(item) === categoryFilter;
      const subcategoryMatches = !subcategoryFilter || subOf(item) === subcategoryFilter;
      const accountMatches = !accountFilter || item.account === accountFilter;
      const cardMatches = !cardFilter || item.cardId === cardFilter;
      return typeMatches && statusMatches && searchMatches && categoryMatches && subcategoryMatches && accountMatches && cardMatches;
    }).sort((a, b) => {
      if (activeType !== 'statement' && a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      // Card purchases in the same invoice all share one dueDate (the
      // card's fixed due day), so sorting by `date` (== dueDate) leaves them
      // in whatever order the DB returned — not chronological. `entryDate`
      // is the real day the purchase happened for every type, so it's the
      // one field that actually orders "most recent first" correctly.
      return (b.entryDate || b.date).localeCompare(a.entryDate || a.date);
    });
  }
  async function settle(item) {
    if (item.invoiceRecord) {
      const ok = await confirmRef.ask({
        title: 'Register this payment?',
        message: `This records ${fmt(item.amount)} as paid from ${item.account} — can't be undone from here, only by deleting the transaction afterwards.`,
        confirmLabel: 'Register payment'
      });
      if (!ok) return;
      payCard(item.cardId).catch((err) => alert(err.message));
    } else {
      toggleTransactionStatus(item.id).catch((err) => alert(err.message));
    }
  }
  async function removeRow(item) {
    const ok = await confirmRef.ask({ title: 'Delete this transaction?', message: "This can't be undone.", confirmLabel: 'Delete' });
    if (!ok) return;
    deleteTransaction(item.id).catch((err) => alert(err.message));
  }
  function cardName(cardId) {
    return $visibleCreditCards.find((card) => card.id === cardId)?.name || 'Credit card';
  }
  function totalableAmount(item) {
    // invoiceRecord/cardPayment are the one-row-per-card stand-in for that
    // month's purchases. Zero them out only when the individual purchases are
    // shown alongside them ($showCardTransactions on) — otherwise they're the
    // only place that card's spend appears, and zeroing them here would drop
    // it from the total entirely instead of just avoiding a double-count.
    return activeType === 'expense' && $showCardTransactions && (item.invoiceRecord || item.cardPayment) ? 0 : item.amount;
  }
  function visibleAmountTotal(status = null) {
    return visibleTransactions().filter((item) => !status || item.status === status).reduce((sum, item) => sum + totalableAmount(item), 0);
  }
  function amountShare(status) {
    const total = visibleAmountTotal();
    return total ? Math.round((visibleAmountTotal(status) / total) * 100) : 0;
  }
  function dayLabel(date) {
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
</script>

<svelte:head><title>Transactions · MyFinance</title></svelte:head>

<PageHeader eyebrow={$monthLabel} title="Transactions" backHref={backHref} stackedActions>
  <div class="header-actions">
    <div class="month-nav">
      <button class="icon-btn" onclick={() => changeMonth(-1)} aria-label="Previous month"><Icon name="chevronLeft" size={15} /></button>
      <button class="month-label" onclick={() => selectedMonth.set(currentMonth())} disabled={$selectedMonth === currentMonth()} title="Back to current month">{$monthLabel}</button>
      <button class="icon-btn" onclick={() => changeMonth(1)} aria-label="Next month"><Icon name="chevronRight" size={15} /></button>
    </div>
    <button class="icon-btn" onclick={() => (detailsOpen = true)} aria-label="Monthly details"><Icon name="dashboard" size={18} /></button>
    <a class="icon-btn" href="/fixed-monthly" aria-label="Fixed monthly"><Icon name="repeat" size={18} /></a>
    <button class="icon-btn" class:on={$privateMode} onclick={() => privateMode.update((v) => !v)} aria-label="Private mode"><Icon name="eye" size={18} /></button>
    <button class="add-button" onclick={() => modalRef.openMenu()}><span>+</span> Add transaction</button>
  </div>
</PageHeader>

<main class="page-content">
  <section class="toolbar g-card">
    {#snippet chipsList()}
      <div class="filter-chips">
        {#each activeFilterChips as chip}
          <span class="filter-chip">{chip.label}<button type="button" onclick={chip.clear} aria-label={`Remove filter ${chip.label}`}><Icon name="close" size={12} /></button></span>
        {/each}
      </div>
    {/snippet}
    <div class="tabs-row">
      <div class="tabs" role="tablist">
        {#each [['expense', 'Expenses'], ['income', 'Income'], ['transfer', 'Transfers'], ['statement', 'Statement']] as tab}
          <button class:active={activeType === tab[0]} onclick={() => (activeType = tab[0])}>{tab[1]}</button>
        {/each}
      </div>
      {#if activeFilterChips.length}
        <div class="desktop-chips">{@render chipsList()}</div>
      {/if}
    </div>
    <div class="filters">
      {#if activeFilterChips.length}
        <div class="mobile-chips">{@render chipsList()}</div>
      {/if}
      <label class="search-box"><Icon name="search" size={16} /><input bind:value={search} placeholder="Search name or amount" /></label>
      <div class="status-filter">
        {#each ['all', 'paid', 'pending'] as status}<button class:active={statusFilter === status} onclick={() => (statusFilter = status)}>{status}</button>{/each}
      </div>
    </div>
  </section>

  <section class="transaction-card g-card">
    <div class="list-head"><span>{visibleTransactions().length} records</span><span>{activeType === 'statement' ? 'Unified chronological view' : `${statusFilter} transactions`}</span></div>
    <div class="transaction-list">
      {#each visibleTransactions() as item, index (item.id)}
        {#if activeType === 'statement' && (index === 0 || (visibleTransactions()[index - 1].entryDate || visibleTransactions()[index - 1].date) !== (item.entryDate || item.date))}
          <div class="day-divider"><span>{dayLabel(item.entryDate || item.date)}</span><i></i></div>
        {/if}
        <article
          class="transaction-row"
          class:editable={!item.invoiceRecord}
          role="button"
          tabindex={item.invoiceRecord ? -1 : 0}
          onclick={() => modalRef.openEdit(item)}
          onkeydown={(event) => { if (!item.invoiceRecord && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); modalRef.openEdit(item); } }}
        >
          <button class="status-button" class:pending={item.status === 'pending'} onclick={(event) => { event.stopPropagation(); settle(item); }} aria-label={item.invoiceRecord ? 'Pay invoice' : 'Toggle status'}><Icon name={item.status === 'paid' ? 'check' : item.invoiceRecord ? 'card' : 'clock'} size={18} /></button>
          <div class="transaction-main"><div class="transaction-name">{#if item.installmentTotal > 1}<span class="installment-pill">{item.installmentNumber}/{item.installmentTotal}</span>{/if}{item.local}</div><div class="transaction-meta"><span class="category-pill">{item.category}</span><span>{item.account}</span>{#if item.type === 'card'}<span class="tag card-tag"><Icon name="card" size={11} /> {cardName(item.cardId)}</span>{/if}{#if item.invoiceRecord}<span class="tag invoice-tag"><Icon name="clock" size={11} /> Invoice due</span>{/if}{#if item.cardPayment}<span class="tag payment-tag"><Icon name="check" size={11} /> Invoice payment</span>{/if}{#if item.recurring}<span class="tag">Recurring</span>{/if}</div>{#if item.items?.length}<div class="transaction-items">{item.items.map((i) => i.amount != null ? `${i.description} (${fmt(i.amount)})` : i.description).join(' · ')}</div>{/if}</div>
          <div class="transaction-side"><time>{new Date(`${item.entryDate || item.date}T12:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</time><strong class:income={item.type === 'income'} class="money">{item.type === 'income' ? '+' : item.type === 'transfer' ? '' : '-'}{fmt(item.amount)}</strong>{#if item.dueDate}<time class="due-date">Due {new Date(`${item.dueDate}T12:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</time>{/if}</div>
          {#if !item.invoiceRecord}<button class="row-action" onclick={(event) => { event.stopPropagation(); removeRow(item); }} aria-label="Delete transaction"><Icon name="close" size={15} /></button>{/if}
        </article>
      {:else}
        <div class="empty"><Icon name="search" size={24} /><strong>No transactions found</strong><span>Try another search or filter.</span></div>
      {/each}
    </div>
    <footer class="totals" class:filtered={statusFilter !== 'all'}>
      {#if statusFilter !== 'pending'}<div class="executed"><span class="total-icon"><Icon name="check" size={16} /></span><div class="total-copy"><span>Executed</span><strong class="money">{fmt(visibleAmountTotal('paid'))}</strong></div><small class="total-share">{amountShare('paid')}% settled</small></div>{/if}
      {#if statusFilter !== 'paid'}<div class="pending"><span class="total-icon"><Icon name="clock" size={16} /></span><div class="total-copy"><span>Pending</span><strong class="money">{fmt(visibleAmountTotal('pending'))}</strong></div><small class="total-share">{amountShare('pending')}% upcoming</small></div>{/if}
      <div class="total"><span class="total-icon"><Icon name="list" size={16} /></span><div class="total-copy"><span>Total</span><strong class="money">{fmt(visibleAmountTotal())}</strong></div><small class="total-share">Filtered amount</small></div>
    </footer>
  </section>
</main>

{#if detailsOpen}
  {@const d = detailsData()}
  <button class="overlay" onclick={() => (detailsOpen = false)} aria-label="Close details"></button>
  <div class="details-modal g-card" role="dialog" aria-label="Monthly details">
    <div class="details-head">
      <div><span class="eyebrow">Details</span><h2>{$monthLabel}</h2></div>
      <button class="close-btn" onclick={() => (detailsOpen = false)} aria-label="Close"><Icon name="close" size={18} /></button>
    </div>

    <div class="details-group">
      <div class="details-title">Overview</div>
      <div class="details-row"><span>Records</span><strong>{d.records}</strong></div>
      <div class="details-row"><span>Total</span><strong class="money">{fmt(d.total)}</strong></div>
      <div class="details-row"><span>Credit cards</span><strong class="money">{fmt(d.cardSpend)}</strong></div>
      <div class="details-row"><span>Account debit</span><strong class="money">{fmt(d.accountDebit)}</strong></div>
    </div>

    <div class="details-group">
      <div class="details-title">Situation</div>
      <div class="details-row"><span>Paid ({d.situation.paidCount})</span><strong class="money">{fmt(d.situation.paid)}</strong></div>
      <div class="details-row"><span>Overdue ({d.situation.overdueCount})</span><strong class="money negative">{fmt(d.situation.overdue)}</strong></div>
      <div class="details-row"><span>Due soon ({d.situation.dueSoonCount})</span><strong class="money">{fmt(d.situation.dueSoon)}</strong></div>
      <div class="details-row"><span>Upcoming ({d.situation.upcomingCount})</span><strong class="money">{fmt(d.situation.upcoming)}</strong></div>
    </div>

    <div class="details-group">
      <div class="details-title">Recurrence</div>
      <div class="details-row"><span>Fixed ({d.recurrence.fixedCount})</span><strong class="money">{fmt(d.recurrence.fixed)}</strong></div>
      <div class="details-row"><span>Installments ({d.recurrence.installmentsCount})</span><strong class="money">{fmt(d.recurrence.installments)}</strong></div>
      <div class="details-row"><span>Variable ({d.recurrence.variableCount})</span><strong class="money">{fmt(d.recurrence.variable)}</strong></div>
    </div>

    <div class="details-group">
      <div class="details-title">Week</div>
      <div class="week-grid">
        {#each d.byWeekday as day}
          <div class="week-cell"><span>{day.label}</span><strong class="money">{fmt(day.total)}</strong><small>{day.count ? fmt(day.total / day.count) : fmt(0)} avg</small></div>
        {/each}
      </div>
      <div class="details-row"><span>Weekdays</span><strong class="money">{fmt(d.weekdaysTotal)}</strong></div>
      <div class="details-row"><span>Weekends</span><strong class="money">{fmt(d.weekendTotal)}</strong></div>
    </div>
  </div>
{/if}


<button class="mobile-fab" onclick={() => modalRef.openMenu()} aria-label="Add transaction">+</button>

<TransactionFormModal bind:this={modalRef} />
<ConfirmModal bind:this={confirmRef} />

<style>
:global(body.transactions-page) {
  height: 100dvh;
  overflow: hidden;
}
:global(body.transactions-page .app-shell), :global(body.transactions-page .app-main) {
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
:global(body.transactions-page .app-main) {
  display: flex;
  flex-direction: column;
}
.page-content {
  width: min(1120px,100%);
  margin: 0 auto;
}
.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.month-nav {
  display: flex;
  align-items: center;
  gap: 6px;
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
.add-button {
  border: 0;
  border-radius: 11px;
  background: var(--accent-solid);
  color: var(--bg);
  padding: 10px 14px;
  font-weight: 800;
  cursor: pointer;
}
.add-button span {
  font-size: 18px;
  margin-right: 5px;
}
.page-content {
  padding: 0 28px 50px;
}
.toolbar {
  padding: 12px;
  margin-bottom: 14px;
}
.tabs, .filters, .status-filter {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tabs-row {
  display: flex;
  align-items: center;
}
.tabs {
  overflow-x: auto;
}
.tabs button, .status-filter button {
  border: 0;
  background: transparent;
  color: var(--muted);
  border-radius: 9px;
  padding: 9px 12px;
  font-weight: 700;
  cursor: pointer;
  text-transform: capitalize;
  white-space: nowrap;
}
.filter-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.desktop-chips {
  margin-left: auto;
  padding-left: 8px;
}
.mobile-chips {
  display: none;
}
.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 6px 6px 6px 12px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
}
.filter-chip button {
  display: flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: rgba(0,0,0,.22);
  color: var(--accent);
  cursor: pointer;
}
.filter-chip button :global(svg) {
  stroke: currentColor;
}
.filter-chip button:hover {
  background: rgba(0,0,0,.34);
}
.tabs button.active, .status-filter button.active {
  background: var(--accent-soft);
  color: var(--accent);
}
.filters {
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-soft);
}
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 380px;
  padding: 8px 10px;
  border-radius: 9px;
  background: var(--panel-strong);
  color: var(--muted);
}
.search-box input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
}
.transaction-card {
  overflow: hidden;
}
.list-head {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  color: var(--faint);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.transaction-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border-top: 1px solid var(--border-soft);
}
.transaction-row.editable {
  cursor: pointer;
}
.transaction-row.editable:hover {
  background: var(--accent-soft);
}
.status-button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 12px;
  background: var(--positive-soft);
  color: var(--positive);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.status-button.pending {
  background: rgba(245,158,11,.16);
  color: var(--planned);
}
.transaction-main {
  flex: 1;
  min-width: 0;
}
.transaction-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 800;
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
.transaction-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
}
.transaction-items {
  margin-top: 3px;
  font-size: 10.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag {
  padding: 2px 5px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent);
}
.transaction-side {
  text-align: right;
}
.transaction-side time {
  display: block;
  color: var(--faint);
  font-size: 10px;
}
.transaction-side strong {
  display: block;
  margin-top: 3px;
  font-size: 14px;
}
.transaction-side time.due-date {
  margin-top: 3px;
}
.transaction-side strong.income {
  color: var(--positive);
}
.row-action {
  border: 0;
  background: transparent;
  color: var(--faint);
  padding: 8px;
  cursor: pointer;
}
.row-action:hover {
  color: var(--negative);
}
.totals {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  border-top: 1px solid var(--border);
  background: var(--panel-strong);
}
.totals>div {
  padding: 13px 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.totals span {
  color: var(--muted);
  font-size: 10px;
}
.totals strong {
  font-size: 13px;
}
.total-copy { display:flex; min-width:0; flex-direction:column; gap:3px; }
.total-icon, .total-share { display:none; }
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 60px 20px;
  color: var(--muted);
}
.empty span {
  font-size: 12px;
}
.mobile-fab {
  display: none;
}
:global(.page-header) {
  flex-shrink: 0;
}
.page-content {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding-bottom: 20px;
}
.toolbar {
  flex-shrink: 0;
}
.transaction-card {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
.transaction-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.totals {
  flex-shrink: 0;
}
.day-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 6px;
  color: var(--accent);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.day-divider i {
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg,var(--border),transparent);
}
.transaction-meta .tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.transaction-meta .invoice-tag {
  background: rgba(245,158,11,.14);
  color: var(--planned);
}
.transaction-meta .payment-tag {
  background: var(--positive-soft);
  color: var(--positive);
}
@media(max-width:900px) {
  .month-nav {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
  }
  .page-content {
    padding: 0 8px 114px;
  }
  .add-button {
    display: none;
  }
  .toolbar {
    padding: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
    backdrop-filter: none;
  }
  .tabs {
    position: fixed;
    left: 6px;
    right: 6px;
    bottom: 6px;
    z-index: 18;
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 4px;
    padding: 5px;
    background: var(--panel-strong);
    border: 1px solid var(--border);
    border-top: 0;
    border-radius: 0 0 16px 16px;
    backdrop-filter: blur(16px);
  }
  .tabs-row {
    display: block;
  }
  .desktop-chips {
    display: none;
  }
  .mobile-chips {
    display: flex;
    width: 100%;
    margin-bottom: 8px;
  }
  .filters:has(.mobile-chips) .search-box {
    display: none;
  }
  .tabs button {
    padding: 10px 3px;
    border-radius: 9px;
    font-size: 10px;
  }
  .tabs button.active {
    background: var(--accent-panel);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
  }
  .filters {
    align-items: stretch;
    flex-direction: column;
    padding: 10px;
    margin-top: 0;
    border: 1px solid var(--border-soft);
    border-radius: 12px;
    background: var(--card);
  }
  .search-box {
    max-width: none;
  }
  .status-filter button {
    flex: 1;
  }
  .list-head span:last-child {
    display: none;
  }
  .transaction-card {
    background: transparent;
    border: 0;
    box-shadow: none;
    backdrop-filter: none;
  }
  .transaction-row {
    padding: 12px 8px;
    gap: 9px;
    margin-bottom: 7px;
    border: 1px solid var(--border-soft);
    border-radius: 13px;
    background: var(--card);
  }
  .transaction-meta span:nth-child(3) {
    display: none;
  }
  .row-action {
    display: none;
  }
  .totals {
    position: fixed;
    left: 6px;
    right: 6px;
    bottom: 55px;
    z-index: 17;
    border: 1px solid var(--border);
    border-bottom: 1px solid var(--border-soft);
    border-radius: 16px 16px 0 0;
    background: var(--panel-strong);
    box-shadow: 0 -14px 36px rgba(0,0,0,.35);
    backdrop-filter: blur(16px);
  }
  .totals>div {
    padding: 9px 10px;
  }
  .totals div+div {
    border-left: 1px solid var(--border-soft);
  }
  .totals span {
    font-size: 9px;
  }
  .totals strong {
    font-size: 12px;
  }
  .totals .total-copy { padding:0; }
  .mobile-fab {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    right: 18px;
    bottom: 126px;
    z-index: 20;
    width: 54px;
    height: 54px;
    border: 0;
    border-radius: 50%;
    background: linear-gradient(155deg, #90a1c6, #6d7d9c);
    color: var(--bg);
    font-size: 29px;
    box-shadow:
      0 1px 0 rgba(255,255,255,.18) inset,
      0 14px 20px -8px rgba(0,0,0,.55),
      0 30px 34px -18px rgba(0,0,0,.4);
    cursor: pointer;
    transition: transform 0.15s;
  }
  .mobile-fab:active {
    transform: scale(0.94);
  }
  .transaction-side strong {
    font-size: 13px;
  }
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
.category-pill {
  padding: 3px 7px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent);
}
.transaction-row {
  transition: background .15s;
}
.transaction-row:hover {
  background: rgba(148,163,184,.035);
}
@media(max-width:900px) {
  .tabs {
    left: 0;
    right: 0;
    bottom: 0;
    height: 51px;
    border: 0;
    border-radius: 0;
    background: var(--bg);
    box-shadow: none;
  }
  .tabs button {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .totals {
    left: 0;
    right: 0;
    bottom: 50px;
    height: 64px;
    gap: 4px;
    padding: 6px 7px;
    border: 0;
    border-radius: 0;
    background: linear-gradient(180deg,var(--panel-strong),var(--bg));
    box-shadow: 0 -10px 28px rgba(0,0,0,.28);
  }
  .totals.filtered {
    grid-template-columns: repeat(2,1fr);
  }
  .totals div {
    align-items: flex-start;
    justify-content: center;
    text-align: left;
    padding: 5px 8px;
    border: 0!important;
    border-radius: 10px;
  }
  .totals span {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .totals strong {
    font-size: 12px;
  }
  .totals .executed strong {
    color: var(--positive);
  }
  .totals .pending strong {
    color: var(--planned);
  }
  .totals .total {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
  }
  .totals .total span, .totals .total strong {
    color: var(--accent);
  }
  .mobile-fab {
    bottom: 126px;
  }
}
@media(min-width:901px) {
  .totals { min-height:72px; background:linear-gradient(180deg,var(--panel-strong),color-mix(in srgb,var(--panel) 72%,var(--bg))); }
  .totals.filtered { grid-template-columns:repeat(2,1fr); }
  .totals>div { position:relative; flex-direction:row; align-items:center; gap:11px; padding:12px 15px; }
  .totals>div+div { border-left:1px solid var(--border-soft); }
  .totals .total-icon { width:34px; height:34px; display:flex; align-items:center; justify-content:center; flex:none; border-radius:11px; }
  .totals .executed .total-icon { background:var(--positive-soft); color:var(--positive); }
  .totals .pending .total-icon { background:rgba(245,158,11,.16); color:var(--planned); }
  .totals .total { background:linear-gradient(90deg,var(--accent-soft),transparent); }
  .totals .total .total-icon { background:var(--accent-soft); color:var(--accent); }
  .totals .executed strong { color:var(--positive); }
  .totals .pending strong { color:var(--planned); }
  .totals .total strong { color:var(--accent); }
  .totals .total-share { display:block; margin-left:auto; padding:4px 7px; border:1px solid var(--border-soft); border-radius:99px; color:var(--muted); font-size:8px; font-weight:700; white-space:nowrap; }
  .totals span { font-size:9px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
  .totals strong { font-size:14px; }
}
.overlay {
  position: fixed;
  inset: 0;
  border: 0;
  background: rgba(4,5,10,.72);
  backdrop-filter: blur(3px);
  z-index: 60;
}
.details-modal {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%,-50%);
  width: min(460px, calc(100% - 32px));
  max-height: 86vh;
  overflow-y: auto;
  z-index: 61;
  padding: 20px;
}
.details-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.details-head h2 {
  margin: 2px 0 0;
  font-size: 17px;
}
.details-head .eyebrow {
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.close-btn {
  border: 0;
  background: transparent;
  color: var(--muted);
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.close-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
}
.details-group {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border-soft);
}
.details-group:first-of-type {
  margin-top: 18px;
}
.details-title {
  margin-bottom: 8px;
  color: var(--faint);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.details-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  color: var(--muted);
  font-size: 12px;
}
.details-row strong {
  color: var(--text);
  font-size: 13px;
}
.details-row strong.negative {
  color: var(--negative);
}
.week-grid {
  display: grid;
  grid-template-columns: repeat(7,1fr);
  gap: 6px;
  margin-bottom: 10px;
}
.week-cell {
  padding: 8px 4px;
  border-radius: 9px;
  background: var(--panel);
  text-align: center;
}
.week-cell span {
  display: block;
  font-size: 8.5px;
  color: var(--faint);
  text-transform: uppercase;
  letter-spacing: .03em;
}
.week-cell strong {
  display: block;
  margin-top: 3px;
  font-size: 10px;
}
.week-cell small {
  display: block;
  margin-top: 2px;
  font-size: 8.5px;
  color: var(--faint);
}
@media (max-width: 900px) {
  .details-modal {
    width: min(420px, calc(100% - 24px));
    padding: 16px;
  }
  .week-grid {
    grid-template-columns: repeat(4,1fr);
  }
}

</style>
