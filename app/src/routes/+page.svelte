<script>
  import { fade } from 'svelte/transition';
  import Icon from '$lib/components/Icon.svelte';
  import IconBadge from '$lib/components/IconBadge.svelte';
  import BankLogo from '$lib/components/BankLogo.svelte';
  import BrandLogo from '$lib/components/BrandLogo.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import TransactionFormModal from '$lib/components/TransactionFormModal.svelte';
  import CardPurchasesModal from '$lib/components/CardPurchasesModal.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar.js';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { categoryIcon } from '$lib/data/mock.js';
  import { transactionSummary, visibleCreditCards, cardTotals, balanceState, overviewDelta, monthLabel, selectedMonth, changeMonth, currentMonth } from '$lib/stores/finance.js';

  function fmt(n) {
    const sign = n < 0 ? '-' : '';
    return sign + 'R$ ' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  let detailsOpen = $state(false);
  let addMenuOpen = $state(false);
  let modalRef;
  let cardModalRef;
  function startAdd(type) {
    addMenuOpen = false;
    modalRef.openAdd(type);
  }
  const addActions = [
    { type: 'expense', label: 'Expense', description: 'Account or cash purchase', icon: 'arrowUp' },
    { type: 'card', label: 'Card expense', description: 'Purchase on a credit card', icon: 'card' },
    { type: 'income', label: 'Income', description: 'Salary, sale or other income', icon: 'arrowDown' },
    { type: 'transfer', label: 'Transfer', description: 'Move money between accounts', icon: 'swap' }
  ];

  $effect(() => {
    document.body.classList.add('summary-page');
    return () => document.body.classList.remove('summary-page');
  });

  function catIcon(category) {
    const base = category.split('·')[0].trim();
    return categoryIcon[base] || 'shapes';
  }

  const categoryColor = {
    Food: 'var(--c-food)', Grocery: 'var(--c-grocery)', Leisure: 'var(--c-leisure)',
    Car: 'var(--c-car)', Bills: 'var(--c-bills)', Subscriptions: 'var(--c-subs)',
    Payments: 'var(--c-payments)', 'Credit cards': 'var(--accent-solid)'
  };

  function catColor(category) {
    return categoryColor[category.split('·')[0].trim()] || 'var(--c-others)';
  }

  // donut geometry
  const r = 46;
  const circ = 2 * Math.PI * r;
  const total = $derived($transactionSummary.categorySpend.reduce((s, c) => s + c.value, 0));
  const hasPendingPlan = $derived($transactionSummary.expenses.pending > 0 || $transactionSummary.incomes.pending > 0);
  const arcs = $derived.by(() => {
    let acc = 0;
    return $transactionSummary.categorySpend.map((c) => {
      const len = total ? (c.value / total) * circ : 0;
      const arc = { ...c, len, offset: acc };
      acc += len;
      return arc;
    });
  });
</script>

<svelte:head><title>Summary · MyFinance</title></svelte:head>

<div class="topbar">
  <button class="icon-btn mobile-only" onclick={() => sidebarOpen.set(true)} aria-label="Open menu">
    <Icon name="menu" size={19} />
  </button>

  <div class="monthnav">
    <button class="icon-btn" onclick={() => changeMonth(-1)} aria-label="Previous month"><Icon name="chevronLeft" size={15} /></button>
    <button class="month-label" onclick={() => selectedMonth.set(currentMonth())} disabled={$selectedMonth === currentMonth()} title="Back to current month">{$monthLabel}</button>
    <button class="icon-btn" onclick={() => changeMonth(1)} aria-label="Next month"><Icon name="chevronRight" size={15} /></button>
  </div>

  <div class="top-actions">
    <button class="icon-btn" class:on={$privateMode} onclick={() => privateMode.update((v) => !v)} title="Private mode" aria-label="Private mode"><Icon name="eye" size={18} /></button>
    <button class="add-trigger" onclick={() => (addMenuOpen = true)}><span>+</span> Add transaction</button>
  </div>
</div>

<div class="content" class:plan-hidden={!hasPendingPlan}>
  {#if $privateMode}
    <button class="private-notice" onclick={() => privateMode.set(false)}>
      <Icon name="eye" size={16} />
      <span><strong>Private mode is active.</strong> Amounts are hidden.</span>
      <span class="private-action">Disable</span>
    </button>
  {/if}

  <button class="balance-card" onclick={() => (detailsOpen = true)}>
    {#key $monthLabel}<div class="bal-track" in:fade={{ duration: 180 }}>
      <div class="bal-item">
        <div class="bal-node init"><Icon name="check" size={13} /></div>
        <span class="bal-lbl">Initial</span>
        <span class="bal-val money">{fmt($balanceState.opening)}</span>
      </div>
      <div class="bal-item main">
        <div class="bal-node current"></div>
        <span class="bal-lbl">Current balance</span>
        <span class="bal-val hero money">{fmt($balanceState.current)}</span>
      </div>
      <div class="bal-item">
        <div class="bal-node est"><Icon name="clock" size={13} /></div>
        <span class="bal-lbl">Estimated</span>
        <span class="bal-val money">{fmt($balanceState.estimated)}</span>
      </div>
    </div>{/key}
  </button>

  {#if hasPendingPlan}
  <section class="g-card plan-card" aria-labelledby="plan-title">
    <div class="card-title plan-title">
      <div>
        <span class="eyebrow">Monthly plan</span>
        <h3 id="plan-title">To review this month</h3>
      </div>
    </div>

    <div class="plan-list">
      {#if $transactionSummary.expenses.pending > 0}
      <a class="plan-row" href="/transactions?type=expense&status=pending&from=summary">
        <span class="plan-check expense"><Icon name="arrowUp" size={13} /></span>
        <span class="plan-copy">
          <strong>{$transactionSummary.expenses.count} expenses pending</strong>
          <span>{Math.round((($transactionSummary.expenses.total - $transactionSummary.expenses.pending) / $transactionSummary.expenses.total) * 100)}% paid</span>
        </span>
        <span class="plan-amount negative money">-{fmt($transactionSummary.expenses.pending)}</span>
        <Icon name="chevronRight" size={15} />
      </a>
      {/if}

      {#if $transactionSummary.incomes.pending > 0}
      <a class="plan-row" href="/transactions?type=income&status=pending&from=summary">
        <span class="plan-check income"><Icon name="arrowDown" size={13} /></span>
        <span class="plan-copy">
          <strong>{$transactionSummary.incomes.count} income pending</strong>
          <span>{Math.round((($transactionSummary.incomes.total - $transactionSummary.incomes.pending) / $transactionSummary.incomes.total) * 100)}% received</span>
        </span>
        <span class="plan-amount positive money">+{fmt($transactionSummary.incomes.pending)}</span>
        <Icon name="chevronRight" size={15} />
      </a>
      {/if}
    </div>
  </section>
  {/if}

  <div class="g-card credit-card action-card">
    <a class="card-title action-title" href="/credit-cards?from=summary"><h3>Credit cards</h3><span>View cards <Icon name="chevronRight" size={14} /></span></a>
    <div class="cc-list">
      {#each $visibleCreditCards as c}
        <button type="button" class="cc-row" onclick={() => cardModalRef.open(c, $selectedMonth)}>
          <BankLogo badge={c.badge} color={c.color} size={34} />
          <div class="cc-main">
            <div class="cc-name">{c.name}</div>
            <div class="cc-sub"><BrandLogo brand={c.brand} height={11} /> {c.brand}</div>
          </div>
          <div class="cc-amt">
            <div class="cc-amt-item">
              <span class="cc-amt-lbl">Current</span>
              <span class="v money">{fmt(c.invoice)}</span>
            </div>
            <div class="cc-amt-item">
              <span class="cc-amt-lbl">Next · Sep/{String(c.closureDay).padStart(2, '0')}</span>
              <span class="v next money">{fmt(c.nextInvoice)}</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
    <div class="cc-footer">
      <div class="cc-footer-item"><span>Total</span><b class="money">{fmt($cardTotals.current)}</b></div>
      <div class="cc-footer-item"><span>Total next</span><b class="money">{fmt($cardTotals.next)}</b></div>
    </div>
  </div>

  <div class="overview-grid">
    <div class="g-card flow-tile">
      <a class="flow-item" href="/transactions?type=income&from=summary">
        <IconBadge size={30} radius={9} background="var(--positive-soft)" color="var(--positive)"><Icon name="arrowDown" size={15} /></IconBadge>
        <div class="flow-copy"><div class="ov-lbl">Income</div><div class="ov-val money">{fmt($transactionSummary.incomes.executed)}</div><div class="flow-pending money">{fmt($transactionSummary.incomes.pending)} pending</div></div>
        <StatusPill tone={$overviewDelta.incomes.dir === 'up' ? 'positive' : 'negative'}>{$overviewDelta.incomes.dir === 'up' ? '↑' : '↓'} {$overviewDelta.incomes.pct}%</StatusPill>
      </a>
      <div class="flow-divider"></div>
      <a class="flow-item" href="/transactions?type=expense&from=summary">
        <IconBadge size={30} radius={9} background="var(--negative-soft)" color="var(--negative)"><span class="flip-icon"><Icon name="arrowUp" size={15} /></span></IconBadge>
        <div class="flow-copy"><div class="ov-lbl">Expenses</div><div class="ov-val money">{fmt($transactionSummary.expenses.executed)}</div><div class="flow-pending money">{fmt($transactionSummary.expenses.pending)} pending</div></div>
        <StatusPill tone={$overviewDelta.expenses.dir === 'up' ? 'negative' : 'positive'}>{$overviewDelta.expenses.dir === 'up' ? '↑' : '↓'} {$overviewDelta.expenses.pct}%</StatusPill>
      </a>
    </div>
  </div>

  <div class="g-card category-card action-card">
    <a class="card-title action-title" href="/categories?from=summary"><h3>Expenses by category</h3><span>View categories <Icon name="chevronRight" size={14} /></span></a>
    <div class="donut-wrap">
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(148,163,184,0.10)" stroke-width="13" />
        {#each arcs as a}
          <circle
            cx="56"
            cy="56"
            r={r}
            fill="none"
            stroke={a.color}
            stroke-width="13"
            stroke-dasharray="{a.len} {circ - a.len}"
            stroke-dashoffset={-a.offset}
            transform="rotate(-90 56 56)"
          />
        {/each}
        <text x="56" y="53" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="800"
          >R${Math.round(total / 1000)}k</text
        >
        <text x="56" y="68" text-anchor="middle" fill="var(--muted)" font-size="8.5" font-weight="600">total</text>
      </svg>
      <div class="donut-legend">
        {#each $transactionSummary.categorySpend as c}
          <a class="leg-item" href={`/transactions?type=expense&category=${encodeURIComponent(c.name)}&from=summary`}>
            <span class="leg-icon" style="background:color-mix(in srgb, {c.color} 22%, transparent); color:{c.color}">
              <Icon name={catIcon(c.name)} size={11} />
            </span>
            <span class="leg-name">{c.name}</span>
            <span class="leg-val money">{fmt(c.value)}</span>
          </a>
        {/each}
      </div>
    </div>
  </div>

  <div class="g-card latest-card action-card">
    <a class="card-title action-title" href="/transactions?type=expense&from=summary"><h3>Latest expenses</h3><span>View all <Icon name="chevronRight" size={14} /></span></a>
    <div class="latest-list">
      {#each $transactionSummary.latestExpenses.slice(0, 4) as t}
        <a class="tx-row" href={`/transactions?type=expense&q=${encodeURIComponent(t.local)}&from=summary`}>
          <div class="tx-dot" style="background:color-mix(in srgb, {catColor(t.category)} 22%, transparent); color:{catColor(t.category)}">
            <Icon name={catIcon(t.category)} size={16} />
          </div>
          <div class="tx-main">
            <div class="tx-name">{t.local}</div>
            <div class="tx-sub">{t.category}</div>
          </div>
          <div class="tx-amt money">{fmt(t.amount)}</div>
        </a>
      {/each}
    </div>
  </div>
</div>

<button class="mobile-fab" onclick={() => (addMenuOpen = true)} aria-label="Add transaction">+</button>

{#if addMenuOpen}
  <button class="sheet-overlay add-overlay" onclick={() => (addMenuOpen = false)} aria-label="Close transaction menu"></button>
  <aside class="add-menu" aria-labelledby="add-menu-title">
    <div class="sheet-handle"></div>
    <div class="add-heading"><div><span class="eyebrow">New record</span><h2 id="add-menu-title">What do you want to add?</h2></div><button class="icon-btn" onclick={() => (addMenuOpen = false)} aria-label="Close transaction menu"><Icon name="close" size={18} /></button></div>
    <div class="add-list">{#each addActions as action}<button type="button" onclick={() => startAdd(action.type)}><span class={`add-icon ${action.type}`}><Icon name={action.icon} size={17} /></span><span><strong>{action.label}</strong><small>{action.description}</small></span><Icon name="chevronRight" size={15} /></button>{/each}</div>
  </aside>
{/if}

<TransactionFormModal bind:this={modalRef} />
<CardPurchasesModal bind:this={cardModalRef} />

{#if detailsOpen}
  <button class="sheet-overlay" onclick={() => (detailsOpen = false)} aria-label="Fechar"></button>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <h2>Balance details</h2>
    <div class="sub">{$monthLabel}</div>

    <div class="breakdown-group">
      <div class="breakdown-title">Consolidated</div>
      <div class="breakdown-row"><span>Opening balance</span><span class="money">{fmt($balanceState.details.openingBalance)}</span></div>
      <div class="breakdown-row"><span>Executed revenues</span><span class="pos money">+{fmt($balanceState.details.executedRevenues)}</span></div>
      <div class="breakdown-row"><span>Credited transfers</span><span class="pos money">+{fmt($balanceState.details.creditedTransfers)}</span></div>
      <div class="breakdown-row"><span>Debited transfers</span><span class="neg money">-{fmt($balanceState.details.debitedTransfers)}</span></div>
      <div class="breakdown-row"><span>Executed expenses</span><span class="neg money">-{fmt($balanceState.details.executedExpenses)}</span></div>
      <div class="breakdown-row total"><span>Current balance</span><span class="money">{fmt($balanceState.details.currentBalance)}</span></div>
    </div>

    <div class="breakdown-group">
      <div class="breakdown-title">Estimated</div>
      <div class="breakdown-row"><span>Pending revenue</span><span class="money">{fmt($balanceState.details.pendingRevenue)}</span></div>
      <div class="breakdown-row"><span>Pending expenses</span><span class="money">{fmt($balanceState.details.pendingExpenses)}</span></div>
      <div class="breakdown-row total"><span>Estimated balance</span><span class="money">{fmt($balanceState.details.estimatedBalance)}</span></div>
    </div>
  </div>
{/if}

<style>
  @media (min-width: 1100px) {
    :global(body.summary-page) { height: 100dvh; overflow: hidden; }
    :global(body.summary-page .app-shell), :global(body.summary-page .app-main) { height: 100dvh; min-height: 0; overflow: hidden; }
  }
  .topbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 18px 24px;
    flex-shrink: 0;
  }
  .topbar > .mobile-only {
    justify-self: start;
  }
  .topbar > .monthnav {
    grid-column: 2;
    justify-self: center;
  }
  .top-actions {
    grid-column: 3;
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .icon-btn {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: 0.12s;
    flex-shrink: 0;
  }
  .icon-btn:hover {
    background: var(--panel);
    color: var(--text);
  }
  .icon-btn.on {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .mobile-only {
    display: none;
  }
  .add-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    border: 0;
    border-radius: 10px;
    padding: 0 13px;
    background: var(--accent-solid);
    color: var(--bg);
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }
  .add-trigger span { font-size: 18px; line-height: 1; }
  .mobile-fab { display: none; }
  .monthnav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 220px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 13px;
    background: var(--panel);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    font-weight: 700;
    font-size: 14px;
  }
  .month-label {
    width: 140px;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: center;
    color: var(--text);
    font: inherit;
    font-weight: inherit;
    cursor: pointer;
    border-radius: 8px;
  }
  .month-label:not(:disabled):hover {
    color: var(--accent);
  }
  .month-label:disabled {
    cursor: default;
  }
  .monthnav .icon-btn {
    width: 32px;
    height: 32px;
  }

  .content {
    flex: 1;
    width: 100%;
    padding: 0 24px 48px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    align-content: start;
    max-width: 1100px;
    margin: 0 auto;
  }

  .private-notice {
    grid-column: 1 / -1;
    display: none;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 11px 13px;
    border: 1px solid var(--border-hover);
    border-radius: 12px;
    background: var(--accent-panel);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .private-notice span:nth-child(2) {
    flex: 1;
    font-size: 12px;
  }
  .private-action {
    color: var(--accent);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  @media (min-width: 700px) {
    .content {
      grid-template-columns: 1.1fr 1fr;
    }
    .overview-grid {
      grid-column: 1 / -1;
    }
  }

  .balance-card {
    padding: 24px 20px;
    cursor: pointer;
    border: 1px solid var(--border);
    font-family: inherit;
    width: 100%;
    background: var(--card);
    border-radius: var(--radius);
    box-shadow: var(--glow);
    backdrop-filter: blur(var(--card-blur)) saturate(var(--card-saturation));
    -webkit-backdrop-filter: blur(var(--card-blur)) saturate(var(--card-saturation));
    transition: border-color 0.15s;
  }
  .balance-card:hover {
    border-color: var(--border-hover);
  }

  .bal-track {
    display: flex;
    align-items: flex-start;
  }
  .bal-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    position: relative;
    z-index: 1;
    text-align: center;
  }
  .bal-node {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: transparent;
    border: 1.5px solid var(--border-hover);
    color: var(--muted);
  }
  .bal-node.current {
    width: 22px;
    height: 22px;
    border: 0;
    background: var(--muted);
  }
  .bal-lbl {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .bal-val {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    padding: 7px 15px;
    border-radius: 99px;
    background: var(--panel);
    color: var(--text);
  }
  .bal-val.hero {
    padding: 11px 22px;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    background: var(--panel-strong);
    color: var(--text);
    margin-top: 1px;
  }

  .card-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    color: var(--faint);
  }
  .card-title h3 {
    margin: 0;
    font-size: 14.5px;
    font-weight: 700;
    color: var(--text);
  }
  @media (min-width: 1100px) {
    .topbar { padding: 12px 24px; }
    .content {
      max-width: 1280px;
      min-height: 0;
      padding: 0 24px 16px;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-template-rows: 188px auto minmax(0, 1fr);
      grid-template-areas:
        'balance balance balance balance balance balance plan plan plan plan plan plan'
        'cards cards cards cards cards cards flow flow flow flow flow flow'
        'latest latest latest latest latest latest latest latest latest latest latest latest';
      gap: 12px;
      overflow: visible;
    }
    .balance-card { grid-area: balance; height: 188px; padding: 18px 16px; }
    .content.plan-hidden .balance-card { grid-area: 1 / 1 / 2 / 13; }
    .plan-card { grid-area: plan; height: 188px; }
    .credit-card { grid-area: cards; }
    .content > .overview-grid { grid-area: 2 / 7 / 3 / 13; grid-template-columns: minmax(0, 1fr); align-self: start; }
    .content > .overview-grid .flow-tile { height: 84px; }
    .category-card { grid-area: 2 / 7 / 3 / 13; display: flex; min-height: 0; margin-top: 96px; flex-direction: column; }
    .category-card .donut-wrap { flex: 1; justify-content: center; }
    .latest-card { grid-area: latest; display: flex; min-height: 0; flex-direction: column; overflow: hidden; }
    .latest-list { min-height: 0; overflow: hidden; }
    .card-title { padding: 11px 14px 8px; }
    .plan-title { padding: 12px 14px 8px; }
    .plan-list { padding: 0 14px 11px; }
    .plan-row { padding: 7px 10px 6px; }
    .cc-row { margin: 2px 6px; padding: 8px 8px; }
    .cc-footer { margin-top: 0; padding: 6px 14px 8px; }
    .flow-tile { padding: 10px; }
    .donut-wrap { padding: 8px 18px 14px; gap: 24px; flex-wrap: nowrap; }
    .donut-wrap svg { width: 102px; height: 102px; }
    .donut-legend { min-width: 0; gap: 5px; }
    .leg-item { gap: 7px; font-size: 11px; }
    .leg-icon { width: 19px; height: 19px; border-radius: 6px; }
    .tx-row { gap: 8px; margin: 2px 6px; padding: 7px 8px; }
    .tx-dot { width: 29px; height: 29px; }
    .tx-name, .tx-amt { font-size: 12px; }
    .tx-sub { font-size: 9.5px; }
  }
  .plan-card {
    overflow: hidden;
  }
  .action-title {
    color: inherit;
    text-decoration: none;
  }
  .action-title > span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--muted);
    font-size: 9.5px;
    font-weight: 700;
  }
  .action-title:hover > span { color: var(--accent); }
  .plan-title {
    padding: 16px 16px 12px;
  }
  .plan-title h3 {
    margin-top: 3px;
  }
  .eyebrow {
    display: block;
    color: var(--accent);
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .plan-list {
    padding: 0 16px 16px;
  }
  .plan-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 -10px;
    padding: 8px 10px;
    border-radius: 10px;
    color: inherit;
    text-decoration: none;
    transition: background var(--motion-duration);
  }
  .plan-row:hover {
    background: var(--accent-soft);
  }
  .plan-row:hover .plan-copy strong {
    color: var(--accent);
  }
  .plan-row:hover > :global(svg:last-child) {
    color: var(--accent);
  }
  .plan-check {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1.5px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .plan-check.expense {
    color: var(--negative);
    border-color: var(--negative);
  }
  .plan-check.income {
    color: var(--positive);
    border-color: var(--positive);
  }
  .plan-copy {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }
  .plan-copy strong {
    font-size: 12.5px;
    transition: color 0.12s;
  }
  .plan-copy span {
    color: var(--muted);
    font-size: 10.5px;
  }
  .plan-amount {
    font-size: 13px;
    font-weight: 800;
  }
  .plan-amount.negative { color: var(--negative); }
  .plan-amount.positive { color: var(--positive); }
  .plan-row > :global(svg:last-child) { color: var(--faint); }

  .credit-card {
    display: flex;
    flex-direction: column;
  }
  .cc-list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
  }
  .cc-row {
    display: flex;
    align-items: center;
    gap: 11px;
    margin: 2px 8px;
    padding: 10px 8px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    appearance: none;
    transition: background var(--motion-duration);
  }
  .cc-row:hover { background: var(--accent-soft); }
  .cc-main {
    flex: 1;
    min-width: 0;
  }
  .cc-name {
    font-size: 13.5px;
    font-weight: 700;
  }
  .cc-sub {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }
  .cc-amt {
    display: flex;
    align-items: flex-end;
    gap: 14px;
  }
  .cc-amt-item {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
  }
  .cc-amt-lbl {
    font-size: 9.5px;
    color: var(--faint);
    font-weight: 600;
    white-space: nowrap;
  }
  .cc-amt .v {
    font-size: 13.5px;
    font-weight: 700;
  }
  .cc-amt .v.next {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .cc-footer {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px 14px;
    margin-top: 4px;
    font-size: 12.5px;
  }
  .cc-footer-item {
    display: flex;
    gap: 6px;
    align-items: baseline;
    color: var(--muted);
    font-weight: 600;
  }
  .cc-footer b {
    color: var(--text);
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  .flip-icon {
    display: flex;
    transform: scaleY(-1);
  }
  .flow-tile {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: stretch;
    padding: 14px;
  }
  .flow-item {
    display: grid;
    grid-template-columns: 34px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 2px 12px;
    border-radius: 10px;
    color: inherit;
    text-decoration: none;
    transition: background var(--motion-duration);
  }
  .flow-item:hover { background: var(--accent-soft); }
  .flow-divider { display: none; }
  .flow-copy { min-width: 0; }
  .flow-pending { margin-top: 2px; color: var(--faint); font-size: 9.5px; }
  .ov-val {
    font-size: 16px;
    font-weight: 800;
  }
  .ov-lbl {
    font-size: 11px;
    color: var(--muted);
    font-weight: 600;
  }

  .donut-wrap {
    padding: 8px 16px 18px;
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }
  .donut-legend {
    flex: 1;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .leg-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 7px;
    color: inherit;
    text-decoration: none;
  }
  .leg-item:hover { background: var(--accent-soft); }
  .leg-icon {
    width: 20px;
    height: 20px;
    border-radius: 7px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .leg-name {
    flex: 1;
    color: var(--muted);
  }
  .leg-val {
    font-weight: 700;
  }

  .tx-row {
    display: flex;
    align-items: center;
    gap: 11px;
    margin: 2px 8px;
    padding: 9px 8px;
    border-radius: 10px;
    color: inherit;
    text-decoration: none;
    transition: background var(--motion-duration);
  }
  .tx-row:hover { background: var(--accent-soft); }
  .tx-dot {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .tx-main {
    flex: 1;
    min-width: 0;
  }
  .tx-name {
    font-size: 13.5px;
    font-weight: 700;
  }
  .tx-sub {
    font-size: 11px;
    color: var(--muted);
    margin-top: 1px;
  }
  .tx-amt {
    font-size: 13.5px;
    font-weight: 700;
  }

  .sheet-overlay {
    position: fixed;
    inset: 0;
    background: rgba(4, 5, 10, 0.6);
    backdrop-filter: blur(2px);
    border: none;
    z-index: 50;
  }
  .add-menu {
    position: fixed;
    left: 50%;
    top: 50%;
    z-index: 51;
    width: min(430px, calc(100% - 28px));
    padding: 18px;
    transform: translate(-50%, -50%);
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--bg);
  }
  .add-menu .sheet-handle { display: none; }
  .add-heading { display: flex; align-items: center; justify-content: space-between; }
  .add-heading h2 { margin: 3px 0 0; font-size: 19px; }
  .add-list { display: grid; gap: 8px; margin-top: 17px; }
  .add-list>button { display: flex; align-items: center; gap: 11px; width: 100%; padding: 11px; border: 1px solid var(--border-soft); border-radius: 12px; background: var(--panel); color: var(--text); text-decoration: none; font: inherit; text-align: left; cursor: pointer; }
  .add-list>button:hover { border-color: var(--border-hover); background: var(--card-hover); }
  .add-list>button>span:nth-child(2) { display: flex; flex: 1; flex-direction: column; gap: 2px; }
  .add-list strong { font-size: 12px; }
  .add-list small { color: var(--muted); font-size: 10px; }
  .add-icon { display: flex; width: 35px; height: 35px; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 10px; }
  .add-icon.expense { background: var(--negative-soft); color: var(--negative); }
  .add-icon.card { background: rgba(96,165,250,.16); color: #60a5fa; }
  .add-icon.income { background: var(--positive-soft); color: var(--positive); }
  .add-icon.transfer { background: rgba(245,158,11,.16); color: var(--planned); }
  .sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(460px, 100%);
    background: var(--bg);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: 22px 22px 0 0;
    z-index: 51;
    padding: 10px 22px 32px;
    max-height: 82vh;
    overflow-y: auto;
  }
  .sheet-handle {
    width: 36px;
    height: 4px;
    background: var(--border-hover);
    border-radius: 99px;
    margin: 6px auto 14px;
  }
  .sheet h2 {
    font-size: 18px;
    margin: 0 0 4px;
  }
  .sheet .sub {
    font-size: 12.5px;
    color: var(--muted);
    margin-bottom: 18px;
  }
  .breakdown-group {
    margin-bottom: 18px;
  }
  .breakdown-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .breakdown-row {
    display: flex;
    justify-content: space-between;
    padding: 9px 0;
    border-bottom: 1px solid var(--border-soft);
    font-size: 14px;
  }
  .breakdown-row:last-child {
    border-bottom: none;
  }
  .breakdown-row.total {
    font-weight: 800;
    font-size: 15.5px;
    padding-top: 13px;
  }
  .breakdown-row .pos {
    color: var(--positive);
  }
  .breakdown-row .neg {
    color: var(--negative);
  }

  @media (max-width: 900px) {
    .mobile-only {
      display: flex;
    }
    .add-trigger { display: none; }
    .mobile-fab { display: flex; position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom)); z-index: 30; width: 54px; height: 54px; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: linear-gradient(155deg, #90a1c6, #6d7d9c); color: var(--bg); box-shadow: 0 1px 0 rgba(255,255,255,.18) inset, 0 14px 20px -8px rgba(0,0,0,.55), 0 30px 34px -18px rgba(0,0,0,.4); font-size: 28px; cursor: pointer; transition: transform 0.15s; }
    .mobile-fab:active { transform: scale(0.94); }
    .add-menu { left: 0; top: auto; bottom: 0; width: 100%; padding: 10px 18px calc(22px + env(safe-area-inset-bottom)); transform: none; border-radius: 22px 22px 0 0; }
    .add-menu .sheet-handle { display: block; }
    .private-notice {
      display: flex;
    }
    .balance-card {
      background: transparent;
      border: none;
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      padding: 6px 4px 18px;
    }
    .bal-val {
      padding: 6px 10px;
      font-size: 11px;
    }
    .bal-val.hero {
      padding: 9px 16px;
      font-size: clamp(16px, 5vw, 20px);
      white-space: nowrap;
    }
    .bal-lbl {
      font-size: 9.5px;
    }
    .flow-tile { padding: 10px 7px; }
    .flow-item { grid-template-columns: 30px 1fr; gap: 7px; padding: 2px 7px; }
    .flow-item :global(.status-pill) { display: none; }
    .flow-item :global(.icon-badge) { width: 28px !important; height: 28px !important; }
    .flow-item .ov-val { font-size: 13px; }
  }
  @media (min-width: 901px) {
    .add-overlay { background: transparent; backdrop-filter: none; }
    .add-menu { left: auto; right: 24px; top: 66px; width: 390px; padding: 14px; transform: none; border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,.42); }
    .add-heading h2 { font-size: 15px; }
    .add-list { grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 12px; }
    .add-list>button { align-items:flex-start; min-height: 78px; padding: 10px; }
    .add-icon { width: 30px; height: 30px; }
    .add-list small { line-height: 1.25; }
  }
</style>
