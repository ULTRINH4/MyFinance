<script>
  import Icon from '$lib/components/Icon.svelte';
  import FormSelect from '$lib/components/FormSelect.svelte';
  import FormNumber from '$lib/components/FormNumber.svelte';
  import FormDate from '$lib/components/FormDate.svelte';
  import AmountInput from '$lib/components/AmountInput.svelte';
  import { investmentAccounts } from '$lib/data/investments.js';
  import { currentMonth, todayDefaultDate, addInvestment } from '$lib/stores/finance.js';
  import { createModalHistory } from '$lib/modalHistory.js';

  let formOpen = $state(false);
  const modalHistory = createModalHistory(() => { formOpen = false; });
  let selectedAccountId = $state('');
  let formAmount = $state('0.00');
  let formDate = $state(todayDefaultDate(currentMonth()));
  let formTicker = $state('');
  let formShares = $state('1');
  let formProduct = $state('');
  let formRate = $state('');
  let formNote = $state('');
  let saving = $state(false);
  let formError = $state('');

  const selectedAccount = $derived($investmentAccounts.find((account) => account.id === selectedAccountId));

  function reset() {
    selectedAccountId = $investmentAccounts[0]?.id || '';
    formAmount = '0.00';
    formDate = todayDefaultDate(currentMonth());
    formTicker = '';
    formShares = '1';
    formProduct = '';
    formRate = '';
    formNote = '';
    saving = false;
    formError = '';
  }
  export function open() {
    reset();
    formOpen = true;
    modalHistory.opened();
  }
  function close() {
    formOpen = false;
    modalHistory.closed();
  }
  async function submit(event) {
    event.preventDefault();
    saving = true;
    formError = '';
    try {
      await addInvestment(selectedAccountId, {
        amount: formAmount,
        date: formDate,
        note: formNote,
        ticker: formTicker,
        shares: formShares,
        product: formProduct,
        rate: formRate
      });
      close();
    } catch (err) {
      formError = err.message || 'Failed to save the investment.';
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

{#if formOpen}
  <button class="overlay" onclick={close} aria-label="Close form"></button>
  <aside class="form-sheet">
    <div class="sheet-handle"></div>
    <div class="form-heading"><div><span class="eyebrow">New record</span><h2>Add investment</h2></div><button class="icon-btn" onclick={close}><Icon name="close" size={18} /></button></div>
    <form onsubmit={submit}>
      <div class="field"><span>Account</span><FormSelect bind:value={selectedAccountId} options={$investmentAccounts.map((account) => ({ value: account.id, label: account.name }))} ariaLabel="Account" /></div>
      <p class="source-note">From Main Account.{#if selectedAccount?.kind !== 'broker'} Saved as pending until you mark it as done on the Investments page.{/if}</p>
      <div class="field amount-field"><span>Amount applied</span><AmountInput bind:value={formAmount} min={0.01} step={1} ariaLabel="Amount applied" /></div>

      {#if selectedAccount?.kind === 'broker'}
        <div class="field-grid">
          <label class="field"><span>Ticker</span><input bind:value={formTicker} required placeholder="e.g. NVDC34" /></label>
          <div class="field"><span>Shares</span><FormNumber bind:value={formShares} min={0.01} step={0.01} ariaLabel="Shares" /></div>
        </div>
      {:else if selectedAccount}
        <div class="field-grid">
          <label class="field"><span>Product</span><input bind:value={formProduct} required placeholder="e.g. CDB 118% CDI" /></label>
          <label class="field"><span>Rate</span><input bind:value={formRate} placeholder="e.g. 118% CDI" /></label>
        </div>
      {/if}

      <div class="field"><span>Date</span><FormDate bind:value={formDate} ariaLabel="Date" /></div>
      <label class="field"><span>Notes</span><textarea bind:value={formNote} rows="2" placeholder="Optional details"></textarea></label>

      {#if formError}<p class="form-error"><Icon name="close" size={13} /> {formError}</p>{/if}
      <div class="form-footer"><button class="submit-button" disabled={saving}>{saving ? 'Saving…' : 'Save investment'}</button></div>
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
  .source-note {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 11.5px;
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
