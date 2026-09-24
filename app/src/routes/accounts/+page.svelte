<script>
  import Icon from '$lib/components/Icon.svelte';
  import IconBadge from '$lib/components/IconBadge.svelte';
  import BankLogo from '$lib/components/BankLogo.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar.js';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { visibleTransactions, monthLabel, selectedMonth, changeMonth, isAccountExpense, accountOpeningAt, accountClosingAt, currentMonth } from '$lib/stores/finance.js';

  const accounts = [
    { name: 'Main Account', badge: 'MA', color: '#67b8f2', type: 'Main', default: true },
    { name: 'Secondary Account', badge: 'SA', color: '#fb7185', type: 'Main' },
    { name: 'Digital Wallet', badge: 'DW', color: '#7fd18f', type: 'Wallet' },
    { name: 'Cash Wallet', badge: 'CW', color: '#60a5fa', type: 'Wallet' }
  ];
  const fmt = (value) => `${value < 0 ? '-' : ''}R$ ${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const income = (account) => $visibleTransactions.filter((item) => item.type === 'income' && item.account === account.name && item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  const expenses = (account) => $visibleTransactions.filter((item) => isAccountExpense(item) && item.account === account.name && item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  const opening = (account) => accountOpeningAt(account.name, $selectedMonth);
  const creditedTransfers = (account) => $visibleTransactions.filter((item) => item.type === 'transfer' && item.destinationAccount === account.name && item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  const debitedTransfers = (account) => $visibleTransactions.filter((item) => item.type === 'transfer' && item.account === account.name && item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  const pending = (account) => $visibleTransactions.filter((item) => item.status === 'pending' && (
    item.type === 'income' ? item.account === account.name :
    item.type === 'transfer' ? item.account === account.name || item.destinationAccount === account.name :
    isAccountExpense(item) && item.account === account.name
  )).reduce((sum, item) => {
    if (item.type === 'income') return sum + item.amount;
    if (item.type === 'transfer') return sum + (item.destinationAccount === account.name ? item.amount : -item.amount);
    return sum - item.amount;
  }, 0);
  // Real snapshot from the bank statement when available (accountClosingAt),
  // never derived by summing every categorized transaction since 2024 —
  // that approach drifted from the real balance in the past.
  const balance = (account) => accountClosingAt(account.name, $selectedMonth);
  function total(kind) {
    return accounts.reduce((sum, account) => sum + (
      kind === 'balance' ? balance(account) :
      kind === 'estimated' ? balance(account) + pending(account) :
      kind === 'income' ? income(account) :
      expenses(account)
    ), 0);
  }

  let selectedAccount = $state(null);
  function openAccount(account) { selectedAccount = account; }
  function closeAccount() { selectedAccount = null; }

  $effect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && selectedAccount) closeAccount();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });
</script>

<svelte:head><title>Accounts · MyFinance</title></svelte:head>

<PageHeader eyebrow={$monthLabel} title="Accounts" stackedActions>
  <div class="header-actions">
    <div class="month-nav">
      <button class="icon-btn" onclick={() => changeMonth(-1)} aria-label="Previous month"><Icon name="chevronLeft" size={15} /></button>
      <button class="month-label" onclick={() => selectedMonth.set(currentMonth())} disabled={$selectedMonth === currentMonth()} title="Back to current month">{$monthLabel}</button>
      <button class="icon-btn" onclick={() => changeMonth(1)} aria-label="Next month"><Icon name="chevronRight" size={15} /></button>
    </div>
    <button class="icon-btn" class:on={$privateMode} onclick={() => privateMode.update((value) => !value)} aria-label="Private mode"><Icon name="eye" size={18} /></button>
  </div>
</PageHeader>

<main class="page-content">
<section class="overview-grid">
  <article class="metric g-card income"><IconBadge size={38} background="var(--positive-soft)" color="var(--positive)"><Icon name="arrowDown" size={17} /></IconBadge><div><span>Income</span><strong class="money">{fmt(total('income'))}</strong><small>Confirmed this month</small></div></article>
  <article class="metric g-card expense"><IconBadge size={38} background="var(--negative-soft)" color="var(--negative)"><Icon name="arrowUp" size={17} /></IconBadge><div><span>Expenses</span><strong class="money">{fmt(total('expenses'))}</strong><small>Debited from accounts</small></div></article>
  <article class="metric g-card balance"><IconBadge size={38} background="var(--accent-soft)" color="var(--accent)"><Icon name="bank" size={17} /></IconBadge><div><span>Current balance</span><strong class="money">{fmt(total('balance'))}</strong><small>Operational accounts</small></div></article>
  <article class="metric g-card estimated"><IconBadge size={38} background="rgba(245,158,11,.16)" color="var(--planned)"><Icon name="clock" size={17} /></IconBadge><div><span>Estimated</span><strong class="money">{fmt(total('estimated'))}</strong><small>Including pending records</small></div></article>
</section>
<section class="accounts-card g-card">
  <div class="table-head"><span>Account</span><span>Income</span><span>Expenses</span><span>Opening</span><span>Balance</span><span>Estimated</span></div>
  {#each accounts as account}
    <button class="account-row" class:default={account.default} onclick={() => openAccount(account)}>
      <div class="account-main"><BankLogo badge={account.badge} color={account.color} size={38} /><div><div class="name-line"><strong>{account.name}</strong>{#if account.default}<span class="default-badge">Default</span>{/if}</div>{#if account.type}<small>{account.type}</small>{/if}</div></div>
      <div class="value primary" class:negative={balance(account) < 0}><span>Balance</span><strong class="money">{fmt(balance(account))}</strong></div>
      <div class="value estimated"><span>Estimated</span><strong class="money">{fmt(balance(account) + pending(account))}</strong></div>
      <div class="value opening"><Icon name="wallet" size={12} /><span>Opening</span><strong class="money">{fmt(opening(account))}</strong></div>
      <div class="value expense"><Icon name="arrowUp" size={12} /><span>Expenses</span><strong class="money negative-value">{fmt(expenses(account))}</strong></div>
      <div class="value income"><Icon name="arrowDown" size={12} /><span>Income</span><strong class="money positive">{fmt(income(account))}</strong></div>
      <Icon name="chevronRight" size={16} />
    </button>
  {/each}
</section>
</main>

{#if selectedAccount}
  <button class="overlay" onclick={closeAccount} aria-label="Close"></button>
  <div class="account-modal g-card">
    <div class="modal-head">
      <BankLogo badge={selectedAccount.badge} color={selectedAccount.color} size={48} radius={14} />
      <div class="modal-title"><span class="eyebrow">{selectedAccount.type ? `${selectedAccount.type} account` : 'Account'}</span><h2>{selectedAccount.name}</h2></div>
      <button class="icon-btn" onclick={closeAccount} aria-label="Close"><Icon name="close" size={18} /></button>
    </div>

    <div class="modal-hero"><span>Current balance</span><strong class="money">{fmt(balance(selectedAccount))}</strong>{#if selectedAccount.default}<small class="default-tag">Default account</small>{/if}</div>

    <div class="modal-list">
      <div><span>Opening</span><strong class="money">{fmt(opening(selectedAccount))}</strong></div>
      <div><span>Income</span><strong class="money positive">{fmt(income(selectedAccount))}</strong></div>
      <div><span>Expenses</span><strong class="money">{fmt(expenses(selectedAccount))}</strong></div>
      <div><span>Credited transfers</span><strong class="money positive">{fmt(creditedTransfers(selectedAccount))}</strong></div>
      <div><span>Debited transfers</span><strong class="money">{fmt(debitedTransfers(selectedAccount))}</strong></div>
      <div class="total-row"><span>Balance</span><strong class="money">{fmt(balance(selectedAccount))}</strong></div>
      <div class="total-row"><span>Estimated</span><strong class="money">{fmt(balance(selectedAccount) + pending(selectedAccount))}</strong></div>
    </div>

    <a class="modal-link" href={`/transactions?type=statement&account=${encodeURIComponent(selectedAccount.name)}`}>View transactions <Icon name="chevronRight" size={14} /></a>
  </div>
{/if}

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
.page-content {
  padding: 0 28px 50px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.overview-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
.metric { min-height:83px; display:flex; align-items:center; gap:12px; padding:14px; }
.metric>div { min-width:0; }
.metric>div>span, .metric small { display:block; color:var(--muted); font-size:9px; }
.metric strong { display:block; margin:3px 0 2px; font-size:16px; }
.metric.income strong { color:var(--positive); }
.metric.expense strong { color:var(--negative); }
.metric.balance strong { color:var(--accent); }
.accounts-card {
  overflow: hidden;
}
.table-head, .account-row {
  display: grid;
  grid-template-columns: minmax(220px,1.3fr) repeat(5,minmax(100px,1fr));
  grid-template-areas: "main income expense opening primary estimated";
  align-items: center;
}
.account-main { grid-area: main; }
.account-row {
  width: 100%;
  border: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.table-head {
  padding: 12px 50px 12px 16px;
  color: var(--faint);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.table-head span:not(:first-child) {
  text-align: right;
}
.account-row {
  position: relative;
  padding: 13px 50px 13px 16px;
  border-top: 1px solid var(--border-soft);
  background: transparent;
  transition: background .15s;
}
.account-row:hover {
  background: rgba(148,163,184,.06);
}
.account-row.default {
  background: linear-gradient(90deg,var(--accent-soft),transparent 28%);
}
.account-main {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.account-main strong, .account-main small {
  display: block;
}
.account-main strong {
  font-size: 13px;
}
.account-main small, .value span {
  color: var(--muted);
  font-size: 10px;
}
.name-line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.default-badge {
  padding: 2px 5px;
  border-radius: 99px;
  background: var(--positive-soft);
  color: var(--positive);
  font-size: 9px;
}
.value {
  text-align: right;
}
.value span {
  display: none;
}
.value strong {
  font-size: 12px;
}
.value .positive {
  color: var(--positive);
}
.value .negative-value { color:var(--negative); }
.value.primary strong {
  font-size: 14px;
}
.value.primary.negative strong {
  color: var(--negative);
}
.value.estimated strong {
  color: var(--muted);
}
.value.income { grid-area: income; }
.value.expense { grid-area: expense; }
.value.opening { grid-area: opening; }
.value.primary { grid-area: primary; }
.value.estimated { grid-area: estimated; }
.value.opening :global(svg), .value.expense :global(svg), .value.income :global(svg) {
  display: none;
}
.account-row > :global(svg) {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--faint);
}
.overlay {
  position: fixed;
  inset: 0;
  border: 0;
  background: rgba(4,5,10,.72);
  backdrop-filter: blur(3px);
  z-index: 50;
}
.account-modal {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%,-50%);
  width: min(420px, calc(100% - 32px));
  max-height: 84vh;
  overflow-y: auto;
  z-index: 51;
  padding: 22px;
}
.modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.modal-title {
  flex: 1;
  min-width: 0;
}
.modal-title h2 {
  margin: 2px 0 0;
  font-size: 18px;
}
.modal-hero {
  margin: 18px 0;
  padding: 18px;
  border-radius: var(--radius);
  background: var(--accent-panel);
  border: 1px solid var(--border);
}
.modal-hero span {
  display: block;
  color: var(--muted);
  font-size: 11px;
}
.modal-hero strong {
  display: block;
  font-size: 27px;
  margin: 4px 0;
}
.default-tag {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 99px;
  background: var(--positive-soft);
  color: var(--positive);
  font-size: 9.5px;
  font-weight: 800;
}
.modal-list div {
  display: flex;
  justify-content: space-between;
  padding: 10px 2px;
  border-bottom: 1px solid var(--border-soft);
  font-size: 13px;
}
.modal-list span {
  color: var(--muted);
}
.modal-list .total-row {
  font-weight: 800;
  border-bottom: none;
  padding-top: 12px;
}
.modal-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 16px;
  padding: 11px;
  border-radius: 11px;
  background: var(--accent-solid);
  color: var(--bg);
  text-decoration: none;
  font-weight: 800;
  font-size: 13px;
}
@media(max-width:900px) {
  .month-nav {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
  }
  .page-content {
    padding: 0 8px 32px;
    gap: 10px;
  }
  .accounts-card {
    display: flex;
    flex-direction: column;
    background: transparent;
    border: 0;
    box-shadow: none;
    backdrop-filter: none;
  }
  .table-head {
    display: none;
  }
  .overview-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .metric { min-height:68px; padding:10px; }
  .metric strong { font-size:12px; }
  .metric small { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .account-row {
    display: grid;
    grid-template-columns: repeat(3,minmax(0,1fr));
    grid-template-areas:
      "main main main"
      "primary primary primary"
      "estimated estimated estimated"
      "opening expense income";
    gap: 8px 6px;
    padding: 13px 12px 12px;
    margin-bottom: 9px;
    border: 1px solid var(--border-soft);
    border-radius: 14px;
    background: var(--card);
  }
  .account-main {
    grid-area: main;
    padding-right: 26px;
  }
  .value {
    display: block;
    text-align: left;
    padding-top: 8px;
    border-top: 1px solid var(--border-soft);
  }
  .value span {
    display: block;
    margin-bottom: 2px;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .value strong {
    font-size: 11px;
  }
  .value.primary {
    grid-area: primary;
    text-align: center;
  }
  .value.primary span {
    font-size: 9px;
  }
  .value.primary strong {
    font-size: 19px;
  }
  .value.estimated {
    grid-area: estimated;
    padding-top: 0;
    border-top: 0;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
  }
  .value.estimated span {
    display: inline;
  }
  .value.estimated strong {
    font-size: 11px;
  }
  .value.opening, .value.expense, .value.income {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }
  .value.opening { grid-area: opening; }
  .value.expense { grid-area: expense; }
  .value.income { grid-area: income; }
  .value.opening :global(svg), .value.expense :global(svg), .value.income :global(svg) {
    display: block;
    width: 20px;
    height: 20px;
    padding: 4px;
    border-radius: 50%;
    box-sizing: border-box;
  }
  .value.opening :global(svg) {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .value.expense :global(svg) {
    background: var(--negative-soft);
    color: var(--negative);
  }
  .value.income :global(svg) {
    background: var(--positive-soft);
    color: var(--positive);
  }
  .account-row > :global(svg) {
    top: 14px;
    transform: none;
  }
  .account-modal {
    width: min(420px, calc(100% - 24px));
    padding: 18px;
  }
}
</style>
