<script>
  import Icon from '$lib/components/Icon.svelte';
  import BankLogo from '$lib/components/BankLogo.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import { investmentAccounts } from '$lib/data/investments.js';
  import { toggleTransactionStatus, deleteTransaction } from '$lib/stores/finance.js';
  import { createModalHistory } from '$lib/modalHistory.js';

  // Fixed-income actions (withdraw / update value) live in a sibling sheet
  // owned by the page — this modal only asks for it via onAction.
  let { onAction = () => {} } = $props();

  // Tracks the account by id and reads it from the store, so saving a
  // movement or the manual values updates what's on screen right away.
  let selectedId = $state(null);
  const selectedAccount = $derived($investmentAccounts.find((account) => account.id === selectedId) ?? null);
  const modalHistory = createModalHistory(() => { selectedId = null; });
  let confirmRef;
  let actionError = $state('');

  const fmt = (n) => `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  function positionValue(position) {
    return position.ticker ? position.shares * position.currentPrice : position.value;
  }

  const formatDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatStamp = (iso) => new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  export function open(account) {
    selectedId = account.id;
    actionError = '';
    modalHistory.opened();
  }
  function close() {
    selectedId = null;
    modalHistory.closed();
  }
  async function markDone(movement) {
    actionError = '';
    try { await toggleTransactionStatus(movement.id); } catch (err) { actionError = err.message || 'Failed to update the movement.'; }
  }
  async function removeMovement(movement) {
    const label = movement.direction === 'in' ? 'contribution' : 'withdrawal';
    const ok = await confirmRef.ask({ title: `Delete this ${label}?`, message: `${fmt(movement.amount)} on ${formatDate(movement.date)}. The manual values are not changed — this can't be undone.`, confirmLabel: 'Delete' });
    if (!ok) return;
    actionError = '';
    try { await deleteTransaction(movement.id); } catch (err) { actionError = err.message || 'Failed to delete the movement.'; }
  }

  $effect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && selectedAccount) close();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });

  $effect(() => {
    if (selectedAccount) {
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

{#if selectedAccount}
  <button class="overlay" onclick={close} aria-label="Close details"></button>
  <div class="details-modal g-card" role="dialog" aria-label="Investment account details">
    <div class="details-head">
      <BankLogo badge={selectedAccount.badge} color={selectedAccount.color} size={44} />
      <div class="details-title"><h2>{selectedAccount.name}</h2><span>{selectedAccount.kind === 'broker' ? 'Brokerage' : 'Fixed income'}</span></div>
      <button class="close-btn" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button>
    </div>

    <div class="details-totals">
      <div><span>Total invested</span><strong class="money">{fmt(selectedAccount.contributed)}</strong></div>
      <div><span>Current value</span><strong class="money">{fmt(selectedAccount.currentValue)}</strong></div>
    </div>
    {#if selectedAccount.kind === 'investment'}
      <div class="details-meta">
        <span>Available to redeem: <strong class="money">{selectedAccount.redeemable != null ? fmt(selectedAccount.redeemable) : '—'}</strong></span>
        <span>{selectedAccount.updatedAt ? `Updated ${formatStamp(selectedAccount.updatedAt)}` : 'Not updated yet — showing computed values'}</span>
      </div>
      <div class="details-actions">
        <button type="button" class="action-btn" onclick={() => onAction(selectedAccount, 'balances')}>Update value</button>
        <button type="button" class="action-btn" onclick={() => onAction(selectedAccount, 'withdraw')}>Withdraw</button>
      </div>
    {/if}

    <div class="positions-head"><span>Positions</span><span>{selectedAccount.positions.length}</span></div>
    <div class="positions-list">
      {#each selectedAccount.positions as position}
        <div class="position-row">
          <div class="position-main">
            <strong>{position.ticker || position.name}</strong>
            <small>{position.ticker ? `${position.shares} sh · avg ${fmt(position.avgPrice)}` : position.rate}</small>
          </div>
          <div class="position-value">
            <strong class="money">{fmt(positionValue(position))}</strong>
          </div>
        </div>
      {/each}
    </div>

    <div class="positions-head"><span>Latest movements</span><span>{selectedAccount.movements.length}</span></div>
    <div class="movements-list">
      {#each selectedAccount.movements as movement (movement.id)}
        <div class="movement-row">
          <div class="movement-main">
            <strong>{movement.direction === 'in' ? 'Contribution' : 'Withdrawal'}{#if movement.status === 'pending'} <span class="pending-pill">Pending</span>{/if}</strong>
            <small>{formatDate(movement.date)}</small>
          </div>
          <strong class="money movement-amount">{movement.direction === 'in' ? '+' : '-'}{fmt(movement.amount)}</strong>
          {#if movement.status === 'pending'}<button type="button" class="mini-btn" onclick={() => markDone(movement)}>Mark as done</button>{/if}
          <button type="button" class="mini-icon" onclick={() => removeMovement(movement)} aria-label="Delete movement"><Icon name="close" size={13} /></button>
        </div>
      {:else}
        <div class="movement-empty">No movements yet.</div>
      {/each}
    </div>
    {#if actionError}<p class="action-error">{actionError}</p>{/if}
  </div>
{/if}

<ConfirmModal bind:this={confirmRef} />

<style>
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
    max-height: 86vh;
    overflow-y: auto;
    z-index: 51;
    padding: 22px;
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
    margin: 0;
    font-size: 16px;
  }
  .details-title span {
    color: var(--muted);
    font-size: 11px;
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
  }
  .close-btn:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .details-totals {
    display: grid;
    grid-template-columns: repeat(2,1fr);
    gap: 10px;
    margin-top: 18px;
    padding-top: 15px;
    border-top: 1px solid var(--border-soft);
  }
  .details-totals div:last-child { text-align: right; }
  .details-totals span {
    display: block;
    color: var(--muted);
    font-size: 10px;
  }
  .details-totals strong {
    font-size: 13px;
  }
  .positions-head {
    display: flex;
    justify-content: space-between;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--border-soft);
    color: var(--faint);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .05em;
  }
  .position-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 11px 0;
    border-top: 1px solid var(--border-soft);
  }
  .position-main strong, .position-value strong {
    display: block;
    font-size: 13px;
  }
  .position-main small {
    display: block;
    margin-top: 2px;
    color: var(--muted);
    font-size: 10.5px;
  }
  .position-value {
    text-align: right;
  }
  .details-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 10px;
    color: var(--muted);
    font-size: 10.5px;
  }
  .details-meta strong {
    color: var(--text);
  }
  .details-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 14px;
  }
  .action-btn {
    padding: 10px;
    border: 1px solid var(--border-soft);
    border-radius: 10px;
    background: var(--panel-strong);
    color: var(--text);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }
  .action-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .movement-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    border-top: 1px solid var(--border-soft);
  }
  .movement-main {
    flex: 1;
    min-width: 0;
  }
  .movement-main strong {
    display: block;
    font-size: 12.5px;
  }
  .movement-main small {
    color: var(--muted);
    font-size: 10.5px;
  }
  .movement-amount {
    font-size: 12.5px;
    white-space: nowrap;
  }
  .pending-pill {
    margin-left: 4px;
    padding: 1px 6px;
    border-radius: 99px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 9px;
    font-weight: 800;
  }
  .mini-btn {
    padding: 5px 8px;
    border: 0;
    border-radius: 8px;
    background: var(--accent-solid);
    color: var(--bg);
    font: inherit;
    font-size: 10.5px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }
  .mini-icon {
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--faint);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .mini-icon:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .movement-empty {
    padding: 12px 0;
    border-top: 1px solid var(--border-soft);
    color: var(--muted);
    font-size: 11.5px;
  }
  .action-error {
    margin: 10px 0 0;
    color: var(--negative);
    font-size: 11.5px;
    font-weight: 700;
  }
  @media (max-width: 900px) {
    .details-modal {
      width: min(420px, calc(100% - 24px));
      padding: 18px;
    }
  }
</style>
