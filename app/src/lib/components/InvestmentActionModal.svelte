<script>
  import Icon from '$lib/components/Icon.svelte';
  import FormDate from '$lib/components/FormDate.svelte';
  import AmountInput from '$lib/components/AmountInput.svelte';
  import { withdrawInvestment, saveInvestmentBalances, currentMonth, todayDefaultDate } from '$lib/stores/finance.js';
  import { createModalHistory } from '$lib/modalHistory.js';

  // One sheet, two modes, both for fixed-income accounts:
  //  - 'withdraw': saves a PENDING transfer investment → Main Account (a notice
  //    the user marks as done after updating the balances). Never touches
  //    the manual balances; the redeemable value is only a hint.
  //  - 'balances': edits the three manual values (accumulated / redeemable
  //    / total invested). No transaction, no history.
  const fmt = (n) => `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  let formOpen = $state(false);
  const modalHistory = createModalHistory(() => { formOpen = false; });
  let mode = $state('withdraw');
  let account = $state(null);
  let formAmount = $state('0.00');
  let formDate = $state(todayDefaultDate(currentMonth()));
  let formNote = $state('');
  let formAccumulated = $state('0.00');
  let formRedeemable = $state('0.00');
  let formInvested = $state('0.00');
  let saving = $state(false);
  let formError = $state('');

  const amountNumber = $derived(Number(formAmount) || 0);
  // Only a hint: the redeemable value is manual and may be stale, so going
  // over it warns but never blocks.
  const overRedeemable = $derived(mode === 'withdraw' && account?.redeemable != null && amountNumber > account.redeemable);

  export function open(target, nextMode) {
    account = target;
    mode = nextMode;
    formAmount = '0.00';
    formDate = todayDefaultDate(currentMonth());
    formNote = '';
    formAccumulated = (target.currentValue ?? 0).toFixed(2);
    formRedeemable = (target.redeemable ?? target.currentValue ?? 0).toFixed(2);
    formInvested = (target.contributed ?? 0).toFixed(2);
    saving = false;
    formError = '';
    formOpen = true;
    modalHistory.opened();
  }
  function close() {
    formOpen = false;
    modalHistory.closed();
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    saving = true;
    formError = '';
    try {
      if (mode === 'withdraw') {
        if (!(amountNumber > 0)) throw new Error('Enter an amount greater than zero.');
        await withdrawInvestment(account.id, { amount: formAmount, date: formDate, note: formNote });
      } else {
        await saveInvestmentBalances(account.id, { accumulated: formAccumulated, redeemable: formRedeemable, invested: formInvested });
      }
      close();
    } catch (err) {
      formError = err.message || 'Failed to save.';
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    if (formOpen) {
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

{#if formOpen && account}
  <button class="overlay" onclick={close} aria-label="Close form"></button>
  <aside class="form-sheet" role="dialog" aria-label={mode === 'withdraw' ? 'Withdraw' : 'Update value'}>
    <div class="sheet-handle"></div>
    <div class="form-heading"><div><span class="eyebrow">{account.name}</span><h2>{mode === 'withdraw' ? 'Withdraw' : 'Update value'}</h2></div><button class="icon-btn" onclick={close} aria-label="Close"><Icon name="close" size={18} /></button></div>
    <form onsubmit={submit}>
      {#if mode === 'withdraw'}
        <p class="hint">Goes to Main Account. Saved as pending until you mark it as done on the Investments page.{#if account.redeemable != null} Available to redeem: <strong class="money">{fmt(account.redeemable)}</strong>.{/if}</p>
        <div class="field amount-field"><span>Amount</span><AmountInput bind:value={formAmount} min={0.01} step={1} ariaLabel="Amount" /></div>
        {#if overRedeemable}<p class="warn"><Icon name="clock" size={13} /> Above the available-to-redeem value ({fmt(account.redeemable)}). You can still save it.</p>{/if}
        <div class="field"><span>Date</span><FormDate bind:value={formDate} ariaLabel="Date" /></div>
        <label class="field"><span>Notes</span><textarea bind:value={formNote} rows="2" placeholder="Optional details"></textarea></label>
      {:else}
        <p class="hint">Manual values, taken from your statement. They don't create transactions and don't change on their own.</p>
        <div class="field amount-field"><span>Accumulated value</span><AmountInput bind:value={formAccumulated} min={0} step={1} ariaLabel="Accumulated value" /></div>
        <div class="field amount-field"><span>Available to redeem</span><AmountInput bind:value={formRedeemable} min={0} step={1} ariaLabel="Available to redeem" /></div>
        <div class="field amount-field"><span>Total invested</span><AmountInput bind:value={formInvested} min={0} step={1} ariaLabel="Total invested" /></div>
      {/if}
      {#if formError}<p class="form-error"><Icon name="close" size={13} /> {formError}</p>{/if}
      <div class="form-footer"><button class="submit-button" disabled={saving}>{saving ? 'Saving…' : mode === 'withdraw' ? 'Save withdrawal' : 'Save values'}</button></div>
    </form>
  </aside>
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
    z-index: 50;
  }
  .form-sheet {
    position: fixed;
    right: 0;
    top: 0;
    width: min(460px,100%);
    height: 100vh;
    overflow-y: auto;
    background: var(--bg);
    border-left: 1px solid var(--border);
    z-index: 51;
    padding: 24px;
  }
  .sheet-handle {
    display: none;
  }
  .form-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--border-soft);
  }
  .form-heading h2 {
    margin: 2px 0 0;
    font-size: 22px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
  }
  .field>span {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
  }
  .field input, .field textarea {
    width: 100%;
    border: 1px solid var(--border-soft);
    border-radius: 10px;
    background: var(--panel-strong);
    color: var(--text);
    padding: 11px 12px;
    outline: 0;
    font: inherit;
  }
  .field input:focus, .field textarea:focus {
    border-color: var(--accent);
  }
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 12px;
  }
  .form-footer {
    padding-top: 4px;
  }
  .submit-button {
    width: 100%;
    padding: 13px;
    border: 0;
    border-radius: 11px;
    background: var(--accent-solid);
    color: var(--bg);
    font-weight: 800;
    cursor: pointer;
  }
  .submit-button:disabled {
    opacity: .6;
    cursor: default;
  }
  .hint {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 11.5px;
    line-height: 1.5;
  }
  .hint strong {
    color: var(--text);
  }
  .warn {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: -6px 0 14px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
  }
  .form-error {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 14px;
    padding: 9px 11px;
    border-radius: 9px;
    background: var(--negative-soft);
    color: var(--negative);
    font-size: 11.5px;
    font-weight: 700;
  }
  .form-error :global(svg) {
    flex-shrink: 0;
  }
  @media(max-width:900px) {
    .form-sheet {
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: auto;
      max-height: 92vh;
      border: 0;
      border-radius: 22px 22px 0 0;
      padding: 10px 18px calc(22px + env(safe-area-inset-bottom));
    }
    .sheet-handle {
      display: block;
      width: 36px;
      height: 4px;
      margin: 0 auto 14px;
      border-radius: 99px;
      background: var(--border-hover);
    }
    .overlay {
      display: none;
    }
    .field-grid {
      grid-template-columns: 1fr;
    }
  }
  @media(min-width:901px) {
    .form-sheet {
      left: 50%;
      right: auto;
      top: 50%;
      width: min(460px,calc(100% - 40px));
      height: auto;
      max-height: 90vh;
      transform: translate(-50%,-50%);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px;
    }
  }
</style>
