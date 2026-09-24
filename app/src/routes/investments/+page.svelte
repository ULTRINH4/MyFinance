<script>
  import Icon from '$lib/components/Icon.svelte';
  import BankLogo from '$lib/components/BankLogo.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import InvestmentDetailsModal from '$lib/components/InvestmentDetailsModal.svelte';
  import AddInvestmentModal from '$lib/components/AddInvestmentModal.svelte';
  import InvestmentActionModal from '$lib/components/InvestmentActionModal.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar.js';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { availableMonths, selectedMonth, monthLabel, toggleTransactionStatus } from '$lib/stores/finance.js';
  import { investmentAccounts } from '$lib/data/investments.js';

  const fmt = (n) => `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalContributed = $derived($investmentAccounts.reduce((sum, a) => sum + a.contributed, 0));
  const totalCurrent = $derived($investmentAccounts.reduce((sum, a) => sum + a.currentValue, 0));

  const monthIndex = $derived(availableMonths.indexOf($selectedMonth));
  const portfolioByMonth = $derived(availableMonths.map((month, i) => $investmentAccounts.reduce((sum, a) => sum + a.monthlyValues[i], 0)));
  const maxPortfolio = $derived(Math.max(1, ...portfolioByMonth));
  const monthShort = (m) => new Date(`${m}-02T12:00:00`).toLocaleDateString('en-US', { month: 'short' });

  // Aporte / retirada saved as pending: a notice until the user has updated
  // the manual values and marks the movement as done.
  const pendingMovements = $derived($investmentAccounts.flatMap((account) => account.pendingMovements.map((movement) => ({ ...movement, accountName: account.name }))).sort((a, b) => a.date.localeCompare(b.date)));
  const formatDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  let pendingError = $state('');
  async function markDone(movement) {
    pendingError = '';
    try { await toggleTransactionStatus(movement.id); } catch (err) { pendingError = err.message || 'Failed to update the movement.'; }
  }

  let modalRef;
  let addModalRef;
  let actionModalRef;
</script>

<svelte:head><title>Investments · MyFinance</title></svelte:head>

<PageHeader eyebrow="Portfolio" title="Investments">
  <button class="icon-btn" class:on={$privateMode} onclick={() => privateMode.update((v) => !v)} aria-label="Private mode"><Icon name="eye" size={18} /></button>
  <button class="add-button" onclick={() => addModalRef.open()}><span>+</span> Add investment</button>
</PageHeader>

<main class="page-content">
  {#if pendingMovements.length}
    <section class="g-card pending-card" aria-label="Pending movements">
      <div class="card-title"><h3>Pending movements</h3><span>{pendingMovements.length}</span></div>
      <p class="pending-hint">Update the account values, then mark each movement as done.</p>
      {#each pendingMovements as movement (movement.id)}
        <div class="pending-row">
          <div class="pending-main"><strong>{movement.direction === 'in' ? 'Contribution' : 'Withdrawal'} · {movement.accountName}</strong><small>{formatDate(movement.date)}</small></div>
          <strong class="money">{movement.direction === 'in' ? '+' : '-'}{fmt(movement.amount)}</strong>
          <button type="button" class="pending-done" onclick={() => markDone(movement)}>Mark as done</button>
        </div>
      {/each}
      {#if pendingError}<p class="pending-error">{pendingError}</p>{/if}
    </section>
  {/if}

  <section class="summary-strip g-card">
    <div class="summary-item primary"><span class="summary-icon"><Icon name="trending" size={16} /></span><span class="summary-copy"><small>Current value</small><strong class="money">{fmt(totalCurrent)}</strong></span></div>
    <div class="summary-item"><span class="summary-icon"><Icon name="wallet" size={16} /></span><span class="summary-copy"><small>Total invested</small><strong class="money">{fmt(totalContributed)}</strong></span></div>
  </section>

  <section class="g-card evolution-card">
    <div class="card-title"><h3>Portfolio evolution</h3><span>{$monthLabel}</span></div>
    <div class="evolution-chart">
      <svg viewBox="0 0 372 140" width="100%" height="140" preserveAspectRatio="xMidYMid meet">
        {#each portfolioByMonth as value, i}
          {@const barHeight = Math.max(4, (value / maxPortfolio) * 96)}
          <rect x={i * 31 + 8} y={112 - barHeight} width="20" height={barHeight} rx="4" fill={i === monthIndex ? 'var(--accent-solid)' : 'color-mix(in srgb, var(--text) 16%, transparent)'} />
          <text x={i * 31 + 18} y="128" text-anchor="middle" font-size="9" fill="var(--faint)">{monthShort(availableMonths[i])}</text>
        {/each}
      </svg>
    </div>
  </section>

  <div class="accounts-grid">
    {#each $investmentAccounts as account}
      <button class="g-card account-card" onclick={() => modalRef.open(account)}>
        <div class="account-head">
          <BankLogo badge={account.badge} color={account.color} size={42} />
          <div class="account-name"><h2>{account.name}</h2><span>{account.kind === 'broker' ? 'Brokerage' : 'Fixed income'}</span></div>
        </div>

        <div class="account-totals">
          <div><span>Total invested</span><strong class="money">{fmt(account.contributed)}</strong></div>
          <div><span>Current value</span><strong class="money">{fmt(account.currentValue)}</strong></div>
        </div>

        <div class="account-footer"><span>{account.positions.length} position{account.positions.length === 1 ? '' : 's'}</span><span class="view-link">View details <Icon name="chevronRight" size={13} /></span></div>
      </button>
    {/each}
  </div>

  <p class="footnote"><Icon name="list" size={14} /> Total invested, current value and available-to-redeem are manual values (Update value on each account) and do not change on their own. Contributions and withdrawals are real transfers from/to Main Account and stay pending until marked as done. Stock prices are the average paid at purchase, not live market data.</p>
</main>

<button class="mobile-fab" onclick={() => addModalRef.open()} aria-label="Add investment">+</button>

<InvestmentDetailsModal bind:this={modalRef} onAction={(account, mode) => actionModalRef.open(account, mode)} />
<InvestmentActionModal bind:this={actionModalRef} />
<AddInvestmentModal bind:this={addModalRef} />

<style>
.page-content {
  width: min(1120px,100%);
  margin: 0 auto;
}
.icon-btn {
  width: 36px;
  height: 36px;
  margin-left: auto;
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
.mobile-fab {
  display: none;
}
.page-content {
  padding: 0 28px 50px;
}
.summary-strip {
  display: grid;
  grid-template-columns: repeat(2,1fr);
  gap: 6px;
  padding: 6px;
  margin-bottom: 16px;
  background: linear-gradient(135deg,var(--panel),color-mix(in srgb,var(--accent-panel) 30%,var(--panel)));
}
.summary-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: 11px;
}
.summary-item.primary {
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
.summary-copy {
  min-width: 0;
}
.summary-copy small {
  display: block;
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 9px;
}
.summary-copy strong {
  display: block;
  font-size: 14px;
}
.pending-card {
  padding: 4px 0 8px;
  margin-bottom: 16px;
}
.pending-hint {
  margin: 0;
  padding: 0 18px 6px;
  color: var(--muted);
  font-size: 11px;
}
.pending-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-top: 1px solid var(--border-soft);
}
.pending-main {
  flex: 1;
  min-width: 0;
}
.pending-main strong {
  display: block;
  font-size: 12.5px;
}
.pending-main small {
  color: var(--muted);
  font-size: 10.5px;
}
.pending-done {
  padding: 7px 11px;
  border: 0;
  border-radius: 9px;
  background: var(--accent-solid);
  color: var(--bg);
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}
.pending-error {
  margin: 6px 18px 0;
  color: var(--negative);
  font-size: 11.5px;
  font-weight: 700;
}
.evolution-card {
  padding: 4px 0 14px;
  margin-bottom: 16px;
}
.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 6px;
}
.card-title h3 {
  margin: 0;
  font-size: 14.5px;
}
.card-title span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}
.evolution-chart {
  padding: 4px 12px 0;
}
.accounts-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 16px;
}
.account-card {
  width: 100%;
  border: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  padding: 18px;
  transition: border-color .15s;
}
.account-card:hover {
  border-color: var(--border-hover);
}
.account-head {
  display: flex;
  align-items: center;
  gap: 11px;
}
.account-name {
  flex: 1;
  min-width: 0;
}
.account-name h2 {
  margin: 0;
  font-size: 15px;
}
.account-name span {
  color: var(--muted);
  font-size: 11px;
}
.account-totals {
  display: grid;
  grid-template-columns: repeat(2,1fr);
  gap: 10px;
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid var(--border-soft);
}
.account-totals div:last-child { text-align: right; }
.account-totals span {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.account-totals strong {
  font-size: 13px;
}
.account-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--border-soft);
  color: var(--muted);
  font-size: 11px;
}
.view-link {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--accent);
  font-weight: 700;
}
.footnote {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 18px 2px 0;
  color: var(--muted);
  font-size: 10.5px;
}
.footnote code {
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--panel);
  font-size: 10px;
}
@media(max-width:900px) {
  .page-content {
    padding: 0 8px 32px;
  }
  .accounts-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .account-card {
    padding: 14px;
  }
  .add-button {
    display: none;
  }
  .mobile-fab {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    right: 18px;
    bottom: 24px;
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
}
</style>
