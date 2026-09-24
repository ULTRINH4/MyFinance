<script>
  import Icon from '$lib/components/Icon.svelte';
  import FormSelect from '$lib/components/FormSelect.svelte';
  import FormNumber from '$lib/components/FormNumber.svelte';
  import FormDate from '$lib/components/FormDate.svelte';
  import AmountInput from '$lib/components/AmountInput.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import FormCheckbox from '$lib/components/FormCheckbox.svelte';
  import { portal } from '$lib/portal.js';
  import { createModalHistory } from '$lib/modalHistory.js';
  import { transactions, visibleCreditCards, selectedMonth, taxonomy, catOf, subOf, addTransaction, addInstallments, updateTransaction, updateFixedTransaction, updateInstallmentGroup, deleteTransaction, installmentSiblings, todayDefaultDate, currentMonth } from '$lib/stores/finance.js';

  let confirmRef;
  // Android/mobile hardware back closes whichever of typeMenuOpen/formOpen
  // is showing instead of navigating the browser away — see modalHistory.js.
  const modalHistory = createModalHistory(() => { typeMenuOpen = false; formOpen = false; });

  let typeMenuOpen = $state(false);
  let formOpen = $state(false);
  let formType = $state('expense');
  let moreOptions = $state(false);
  let itemsOpen = $state(false);
  let formItems = $state([]);
  let formAmount = $state('0.00');
  let formDueDate = $state(todayDefaultDate(currentMonth()));
  let formRegistrationDate = $state(todayDefaultDate(currentMonth()));
  let formSettlementDate = $state('');
  let formInvoiceMonth = $state(currentMonth());
  let formLocal = $state('');
  let formNote = $state('');
  let formConfirmed = $state(true);
  let formIgnoreCardLimit = $state(false);
  let editingId = $state(null);
  let editingGroupId = $state(null);
  let recurrenceType = $state('none');
  let installmentStart = $state(1);
  let installmentTotal = $state(2);
  let installmentFrequency = $state('monthly');
  let formGroupTotal = $state('0.00');
  let selectedCategory = $state('Food');
  let selectedSubcategory = $state('Meals');
  let selectedAccount = $state('Main Account');
  let destinationAccount = $state('Secondary Account');
  let selectedCardId = $state('');
  let saving = $state(false);
  let formError = $state('');
  const accounts = ['Main Account', 'Secondary Account', 'Digital Wallet', 'Cash Wallet'];
  // Real taxonomy from Postgres (via $transactions), never a hardcoded
  // guess — a category/subcategory picked here has to exist for real or
  // saving fails server-side. "card" purchases share the expense taxonomy.
  const categoryType = $derived(formType === 'income' ? 'income' : 'expense');
  const categories = $derived(Object.keys($taxonomy[categoryType]).sort());
  const subcategoryOptions = $derived($taxonomy[categoryType][selectedCategory] || []);
  const actionChoices = [
    { type: 'expense', label: 'Expense', detail: 'Account or cash purchase', icon: 'arrowUp' },
    { type: 'card', label: 'Card expense', detail: 'Add to a credit card invoice', icon: 'card' },
    { type: 'income', label: 'Income', detail: 'Salary, sale or payment', icon: 'arrowDown' },
    { type: 'transfer', label: 'Transfer', detail: 'Move money between accounts', icon: 'swap' }
  ];

  // installmentSiblings() reads the store via get(), a one-off snapshot that
  // Svelte's $derived can't track — using it here meant this only recomputed
  // when editingGroupId itself changed, never when the underlying data did
  // (e.g. after a save), leaving the banner showing a stale amount while the
  // "Amount" field below — set fresh from the clicked item — was correct.
  // Reading $transactions directly keeps both in sync.
  const groupSiblings = $derived(editingGroupId
    ? $transactions.filter((t) => t.installmentGroupId === editingGroupId).sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0))
    : []);
  const groupTotal = $derived(groupSiblings.reduce((sum, item) => sum + item.amount, 0));
  const thisInstallmentAmount = $derived(groupSiblings.find((item) => item.id === editingId)?.amount ?? Number(formAmount));

  function goToSibling(delta) {
    const index = groupSiblings.findIndex((item) => item.id === editingId);
    const sibling = groupSiblings[index + delta];
    if (sibling) openEdit(sibling);
  }

  // All-time, not just the currently viewed month (that was the real
  // limit — a vendor only used two months ago wouldn't suggest at all),
  // split by the same expense/income pool the form itself uses, and
  // tracks the most recent category/subcategory per local so picking a
  // known local can guess the category too.
  function localStats() {
    const stats = new Map();
    if (formType === 'transfer') return stats;
    for (const t of $transactions) {
      if (!t.local) continue;
      const matchesType = formType === 'income' ? t.type === 'income' : (t.type === 'expense' || t.type === 'card');
      if (!matchesType) continue;
      const entry = stats.get(t.local) || { count: 0, lastDate: '', category: '', subcategory: '' };
      entry.count++;
      if (t.date > entry.lastDate) { entry.lastDate = t.date; entry.category = catOf(t); entry.subcategory = subOf(t); }
      stats.set(t.local, entry);
    }
    return stats;
  }
  function localSuggestions() {
    return [...localStats().entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).map(([local]) => local);
  }
  function applyLocalMemory() {
    if (editingId) return;
    const match = localStats().get(formLocal);
    if (!match) return;
    if (categories.includes(match.category)) selectedCategory = match.category;
    if (match.subcategory) selectedSubcategory = match.subcategory;
  }

  // Custom dropdown instead of a native <input list=datalist> — the native
  // one is OS-rendered on mobile (Android/iOS), so it can't be positioned or
  // filtered: it shows every local at once and can overlap the on-screen
  // keyboard. Matches only kick in after 3 characters, same threshold as
  // most real autocomplete UIs, so it doesn't dump the whole list on focus.
  let localMenuOpen = $state(false);
  let localInputEl;
  let localMenuRect = $state(null);
  function localMatches() {
    const q = formLocal.trim().toLowerCase();
    if (q.length < 3) return [];
    return localSuggestions().filter((l) => l.toLowerCase().includes(q)).slice(0, 8);
  }
  function updateLocalMenu() {
    if (formType === 'transfer' || localMatches().length === 0) { localMenuOpen = false; return; }
    const rect = localInputEl.getBoundingClientRect();
    localMenuRect = { top: rect.bottom + 6, left: rect.left, width: rect.width };
    localMenuOpen = true;
  }
  function onLocalInput() {
    applyLocalMemory();
    updateLocalMenu();
  }
  function chooseLocal(local) {
    formLocal = local;
    applyLocalMemory();
    localMenuOpen = false;
  }
  function addItem() {
    itemsOpen = true;
    formItems = [...formItems, { description: '', amount: '', showAmount: false }];
  }
  function toggleItemAmount(index) {
    formItems[index].showAmount = !formItems[index].showAmount;
    if (!formItems[index].showAmount) formItems[index].amount = '';
    formItems = [...formItems];
  }
  function removeItem(index) {
    formItems = formItems.filter((_, itemIndex) => itemIndex !== index);
    if (!formItems.length) itemsOpen = false;
  }
  function defaultInvoiceMonthFor(closureDay) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    if (now.getDate() > closureDay) { month += 1; if (month > 12) { month = 1; year += 1; } }
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  function resetFormDetails() {
    editingId = null;
    editingGroupId = null;
    saving = false;
    formError = '';
    itemsOpen = false;
    formItems = [];
    formAmount = '0.00';
    formLocal = '';
    formNote = '';
    formConfirmed = formType !== 'card';
    formIgnoreCardLimit = false;
    formDueDate = todayDefaultDate($selectedMonth);
    formRegistrationDate = todayDefaultDate($selectedMonth);
    formSettlementDate = '';
    {
      const card = formType === 'card' ? $visibleCreditCards.find((c) => c.id === selectedCardId) : null;
      formInvoiceMonth = card ? defaultInvoiceMonthFor(card.closureDay) : $selectedMonth;
    }
    recurrenceType = 'none';
    installmentStart = 1;
    installmentTotal = 2;
    installmentFrequency = 'monthly';
  }

  $effect(() => {
    if (formType === 'card' && !selectedCardId && $visibleCreditCards.length) selectedCardId = $visibleCreditCards[0].id;
  });
  $effect(() => {
    if (formOpen || typeMenuOpen) {
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
    if (categories.length && !categories.includes(selectedCategory)) selectedCategory = categories[0];
  });
  $effect(() => {
    if (subcategoryOptions.length && !subcategoryOptions.includes(selectedSubcategory)) selectedSubcategory = subcategoryOptions[0];
    else if (!subcategoryOptions.length) selectedSubcategory = '';
  });

  function closeForm() {
    formOpen = false;
    fixedScopeOpen = false;
    pendingFixedSave = null;
    modalHistory.closed();
  }
  function closeMenu() {
    typeMenuOpen = false;
    modalHistory.closed();
  }
  export function openMenu() {
    typeMenuOpen = true;
    modalHistory.opened();
  }
  export function openAdd(type, options = {}) {
    formType = type;
    selectedCardId = type === 'card' ? (options.cardId || $visibleCreditCards[0]?.id || '') : '';
    moreOptions = false;
    resetFormDetails();
    typeMenuOpen = false;
    formOpen = true;
    modalHistory.opened();
  }
  export function openEdit(item) {
    if (item.invoiceRecord) return;
    editingId = item.id;
    editingGroupId = item.installmentGroupId || null;
    formGroupTotal = editingGroupId ? installmentSiblings(editingGroupId).reduce((sum, sib) => sum + sib.amount, 0).toFixed(2) : '0.00';
    formType = item.type;
    formLocal = item.local || '';
    formAmount = Number(item.amount || 0).toFixed(2);
    formDueDate = item.dueDate || item.date || todayDefaultDate($selectedMonth);
    formRegistrationDate = item.entryDate || item.date || formDueDate;
    formSettlementDate = item.settlementDate || '';
    formInvoiceMonth = (item.dueDate || item.date || '').slice(0, 7) || $selectedMonth;
    selectedCategory = categories.includes(catOf(item)) ? catOf(item) : categories[0];
    selectedSubcategory = subOf(item);
    selectedAccount = item.account && accounts.includes(item.account) ? item.account : accounts[0];
    destinationAccount = item.destinationAccount && accounts.includes(item.destinationAccount) ? item.destinationAccount : accounts.find((a) => a !== selectedAccount) || accounts[0];
    selectedCardId = item.cardId || $visibleCreditCards[0]?.id || '';
    recurrenceType = item.recurrence || 'none';
    installmentStart = item.installmentNumber ? Number(item.installmentNumber) : 1;
    installmentTotal = item.installmentTotal ? Number(item.installmentTotal) : 2;
    installmentFrequency = item.installmentFrequency || 'monthly';
    formConfirmed = item.status !== 'pending';
    formNote = item.note || '';
    formIgnoreCardLimit = item.ignoreCardLimit === 'on' || item.ignoreCardLimit === true;
    formItems = (item.items || []).map((row) => ({ description: row.description || '', amount: row.amount == null ? '' : String(row.amount), showAmount: row.amount != null }));
    itemsOpen = formItems.length > 0;
    moreOptions = Boolean(item.note || item.settlementDate || formIgnoreCardLimit);
    typeMenuOpen = false;
    formOpen = true;
    modalHistory.opened();
  }
  // "Fixed monthly" edits have no bounded group to patch (unlike
  // installments) — every future occurrence is its own row, matched only by
  // local+type+recurrence. Editing one is ambiguous (this month only, or
  // this and every month after?) so it's the one case that needs an extra
  // choice before saving, instead of just saving straight away.
  let fixedScopeOpen = $state(false);
  let pendingFixedSave = $state(null);
  const fixedScopeMonthLabel = $derived(formDueDate ? new Date(`${formDueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '');

  async function performSave(event, payload, data) {
    saving = true;
    formError = '';
    try {
      if (editingId) {
        if (editingGroupId) {
          await updateInstallmentGroup(editingGroupId, payload, editingId);
        } else {
          await updateTransaction(editingId, payload);
        }
        closeForm();
      } else {
        if (data.recurrence === 'repeat' && formType !== 'transfer') {
          await addInstallments(payload, data.installmentNumber, data.installmentTotal, data.installmentFrequency);
        } else {
          await addTransaction(payload);
        }
        if (data.saveContinue === 'on') {
          event.currentTarget.reset();
          resetFormDetails();
        }
        else closeForm();
      }
    } catch (err) {
      formError = err.message || 'Failed to save the transaction.';
    } finally {
      saving = false;
    }
  }
  async function submit(event) {
    // Guards against a double-fire (fast double-click / Enter + click landing
    // in the same tick, before `disabled={saving}` re-renders) which used to
    // race two concurrent POSTs and could leave a duplicated record behind.
    if (saving) return;
    saving = true;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    // Registration/settlement date inputs only exist in the DOM once "Add
    // more information" is expanded — FormData silently omits them when
    // it's collapsed (the default), which used to leave entryDate null and
    // fall back to the due date (e.g. a card purchase showing the invoice's
    // fixed due day instead of the day it was actually made). The `form*`
    // state vars are the source of truth regardless of the section's
    // visibility, so always send them explicitly.
    data.registrationDate = formRegistrationDate;
    data.settlementDate = formSettlementDate;
    const items = formItems.filter((item) => item.description.trim()).map((item, position) => ({
      description: item.description.trim(),
      amount: item.amount === '' ? null : Number(item.amount),
      position
    }));
    const payload = { ...data, items, type: formType, status: data.confirmed === 'on' ? 'paid' : 'pending', recurring: data.recurrence !== 'none' };
    if (editingId && !editingGroupId && recurrenceType === 'fixed') {
      pendingFixedSave = { event, payload, data };
      fixedScopeOpen = true;
      saving = false;
      return;
    }
    await performSave(event, payload, data);
  }
  async function chooseFixedScope(scope) {
    const { event, payload, data } = pendingFixedSave;
    fixedScopeOpen = false;
    saving = true;
    formError = '';
    try {
      await updateFixedTransaction(editingId, payload, scope);
      closeForm();
    } catch (err) {
      formError = err.message || 'Failed to save the transaction.';
    } finally {
      saving = false;
      pendingFixedSave = null;
    }
  }
  async function deleteCurrent() {
    const message = editingGroupId
      ? `Delete installment ${installmentStart}/${installmentTotal}? The other installments stay untouched — this can't be undone.`
      : "This can't be undone.";
    const ok = await confirmRef.ask({ title: editingGroupId ? 'Delete this installment?' : 'Delete this transaction?', message, confirmLabel: 'Delete' });
    if (!ok) return;
    saving = true;
    formError = '';
    try {
      await deleteTransaction(editingId);
      closeForm();
    } catch (err) {
      formError = err.message || 'Failed to delete the transaction.';
      saving = false;
    }
  }
</script>

{#if typeMenuOpen}
  <button class="overlay" onclick={closeMenu} aria-label="Close transaction menu"></button>
  <aside class="action-menu">
    <div class="sheet-handle"></div>
    <div class="action-heading"><div><span class="eyebrow">New record</span><h2>What do you want to add?</h2></div><button class="icon-btn" onclick={closeMenu}><Icon name="close" size={18} /></button></div>
    <div class="action-list">
      {#each actionChoices as action}
        <button onclick={() => openAdd(action.type)}>
          <span class="action-icon {action.type}"><Icon name={action.icon} size={19} /></span>
          <span class="action-copy"><strong>{action.label}</strong><small>{action.detail}</small></span>
          <Icon name="chevronRight" size={16} />
        </button>
      {/each}
    </div>
  </aside>
{/if}

{#if formOpen}
  <button class="overlay" onclick={closeForm} aria-label="Close form"></button>
  <aside class="form-sheet">
    <div class="sheet-handle"></div>
    <div class="form-heading"><div><span class="eyebrow">{editingId ? 'Edit record' : 'New record'}</span><h2>{editingId ? 'Edit transaction' : 'Add transaction'}</h2></div><button class="icon-btn" onclick={closeForm}><Icon name="close" size={18} /></button></div>
    <div class="selected-type">
      <span class="action-icon {formType}"><Icon name={actionChoices.find((action) => action.type === formType)?.icon || 'list'} size={17} /></span>
      <div><span>Transaction type</span><strong>{actionChoices.find((action) => action.type === formType)?.label}</strong></div>
      {#if !editingId}<button type="button" onclick={() => { formOpen = false; typeMenuOpen = true; }}>Change</button>{/if}
    </div>
    <form onsubmit={(event) => { event.preventDefault(); submit(event); }}>
      {#if editingGroupId}
        <div class="installment-banner">
          <div class="installment-nav">
            <button type="button" class="nav-arrow" disabled={!groupSiblings[groupSiblings.findIndex((s) => s.id === editingId) - 1]} onclick={() => goToSibling(-1)} aria-label="Previous installment"><Icon name="chevronLeft" size={16} /></button>
            <div class="installment-summary">
              <div><span>This installment</span><strong>{installmentStart}/{installmentTotal} · {thisInstallmentAmount.toFixed(2)}</strong></div>
              <div class="field group-total-field"><span>Full purchase</span><AmountInput name="groupTotal" bind:value={formGroupTotal} min={0.01} step={1} ariaLabel="Full purchase total" /></div>
            </div>
            <button type="button" class="nav-arrow" disabled={!groupSiblings[groupSiblings.findIndex((s) => s.id === editingId) + 1]} onclick={() => goToSibling(1)} aria-label="Next installment"><Icon name="chevronRight" size={16} /></button>
          </div>
          <small>Name, category, account, note and items apply to every installment. Amount below is just for this one — due date and paid/pending status never move. Changing "Full purchase" re-splits it evenly across all {installmentTotal} installments instead.</small>
        </div>
      {/if}
      <label class="field">
        <span>{formType === 'transfer' ? 'Description' : 'Local / Who'}</span>
        <input
          bind:this={localInputEl}
          name="local"
          bind:value={formLocal}
          oninput={onLocalInput}
          onfocus={updateLocalMenu}
          onblur={() => setTimeout(() => (localMenuOpen = false), 150)}
          autocomplete="off"
          required
          placeholder={formType === 'transfer' ? 'Secondary Account → Main Account' : formType === 'income' ? 'Employer, client or person' : 'Store, service or person'}
        />
      </label>
      {#if localMenuOpen && localMenuRect}
        <div use:portal>
          <div class="local-menu" role="listbox" aria-label="Local suggestions" style={`top:${localMenuRect.top}px;left:${localMenuRect.left}px;width:${localMenuRect.width}px`}>
            {#each localMatches() as local}
              <button type="button" role="option" aria-selected={local === formLocal} onmousedown={(event) => { event.preventDefault(); chooseLocal(local); }}>{local}</button>
            {/each}
          </div>
        </div>
      {/if}
      <div class="field amount-field"><span>{editingGroupId ? 'Amount (this installment)' : 'Amount'}</span><AmountInput name="amount" bind:value={formAmount} min={0.01} step={1} ariaLabel="Amount" /></div>
      {#if formType !== 'transfer'}
        <section class="items-section" class:open={itemsOpen}>
          <button class="items-toggle" type="button" onclick={() => itemsOpen ? (itemsOpen = false) : (formItems.length ? (itemsOpen = true) : addItem())}>
            <span><strong>Items</strong><small>Optional · split the transaction into details</small></span>
            <span class="items-toggle-action">{formItems.length ? `${formItems.length} item${formItems.length === 1 ? '' : 's'}` : 'Add items'} <Icon name={itemsOpen ? 'chevronLeft' : 'chevronRight'} size={14} /></span>
          </button>
          {#if itemsOpen}
            <div class="items-content">
              {#each formItems as item, index}
                <article class="item-row">
                  <div class="item-title"><span>Item {index + 1}</span><div class="item-actions">{#if !item.showAmount}<button class="amount-action" type="button" onclick={() => toggleItemAmount(index)}>+ Add amount</button>{/if}<button type="button" onclick={() => removeItem(index)} aria-label="Remove item"><Icon name="close" size={14} /></button></div></div>
                  <label class="field item-description"><span>Description</span><input bind:value={item.description} placeholder="What did you buy?" /></label>
                  {#if item.showAmount}<div class="optional-amount"><label class="field item-amount"><span>Amount <em>optional</em></span><input bind:value={item.amount} min="0.01" step="0.01" type="number" inputmode="decimal" placeholder="R$ 0.00" /></label><button type="button" onclick={() => toggleItemAmount(index)}>Remove amount</button></div>{/if}
                </article>
              {/each}
              <div class="items-footer"><small>Item amounts are optional and do not prevent saving.</small><button type="button" onclick={addItem}>+ Add another item</button></div>
            </div>
          {/if}
        </section>
      {/if}
      <div class="field-grid">
        {#if formType !== 'transfer'}<div class="field"><span>Category</span><FormSelect name="category" bind:value={selectedCategory} options={categories} ariaLabel="Category" /></div>{#if subcategoryOptions.length}<div class="field"><span>Subcategory</span><FormSelect name="subcategory" bind:value={selectedSubcategory} options={subcategoryOptions} ariaLabel="Subcategory" /></div>{/if}{/if}
        {#if formType !== 'card'}<div class="field"><span>Account</span><FormSelect name="account" bind:value={selectedAccount} options={accounts} ariaLabel="Account" /></div>{/if}
        {#if formType === 'transfer'}<div class="field"><span>Destination</span><FormSelect name="destinationAccount" bind:value={destinationAccount} options={accounts} ariaLabel="Destination" /></div>{/if}
        {#if formType === 'card'}<div class="field"><span>Credit card</span><FormSelect name="cardId" bind:value={selectedCardId} options={$visibleCreditCards.map((card) => ({ value: card.id, label: card.name }))} ariaLabel="Credit card" /></div><label class="field"><span>Invoice</span><input name="invoiceMonth" type="month" bind:value={formInvoiceMonth} /></label><label class="field linked-account"><span>Linked account</span><input name="account" readonly value={$visibleCreditCards.find((card) => card.id === selectedCardId)?.account || ''} /><small>Defined by the selected card</small></label>{/if}
        {#if formType !== 'card'}<div class="field"><span>Due date</span><FormDate name="dueDate" bind:value={formDueDate} ariaLabel="Due date" onchange={(picked) => { if (picked > todayDefaultDate(currentMonth())) formConfirmed = false; }} /></div>{/if}
        {#if !editingGroupId}<div class="field"><span>Recurrence</span><FormSelect name="recurrence" bind:value={recurrenceType} options={[{value:'none',label:'Non-recurring'},{value:'repeat',label:'Installment or repeat'},{value:'fixed',label:'Fixed monthly'}]} ariaLabel="Recurrence" /></div>{/if}
      </div>
      {#if recurrenceType === 'repeat' && !editingGroupId}<div class="recurrence-details"><div class="field"><span>Initial installment</span><FormNumber name="installmentNumber" bind:value={installmentStart} min={1} ariaLabel="Initial installment" /></div><div class="field"><span>Quantity</span><FormNumber name="installmentTotal" bind:value={installmentTotal} min={installmentStart} ariaLabel="Installment quantity" /></div><div class="field"><span>Frequency</span><FormSelect name="installmentFrequency" bind:value={installmentFrequency} options={[{value:'monthly',label:'Monthly'},{value:'weekly',label:'Weekly'}]} ariaLabel="Frequency" /></div></div>{/if}
      <label class="confirmed-row"><span><FormCheckbox name="confirmed" bind:checked={formConfirmed} ariaLabel="Confirmed" /> Confirmed</span><small>Turn off to save as pending</small></label>
      <button class="more-button" type="button" onclick={() => (moreOptions = !moreOptions)}>Add more information <Icon name={moreOptions ? 'chevronLeft' : 'chevronRight'} size={14} /></button>
      {#if moreOptions}<div class="advanced"><div class="field-grid"><div class="field"><span>Registration date</span><FormDate name="registrationDate" bind:value={formRegistrationDate} ariaLabel="Registration date" /></div><div class="field"><span>Settlement date</span><FormDate name="settlementDate" bind:value={formSettlementDate} ariaLabel="Settlement date" /></div></div><label class="field"><span>Notes</span><textarea name="note" bind:value={formNote} rows="2" placeholder="Optional details"></textarea></label>{#if formType === 'card'}<label class="check"><FormCheckbox name="ignoreCardLimit" bind:checked={formIgnoreCardLimit} ariaLabel="Ignore on the card limit" /> Ignore on the card limit</label>{/if}</div>{/if}
      {#if formError}<p class="form-error"><Icon name="close" size={13} /> {formError}</p>{/if}
      <div class="form-footer">{#if editingId}<button type="button" class="delete-button" disabled={saving} onclick={deleteCurrent}><Icon name="close" size={13} /> Delete</button>{:else}<label class="check save-continue"><FormCheckbox name="saveContinue" ariaLabel="Save and continue" /> Save and continue</label>{/if}<button class="submit-button" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save transaction'}</button></div>
    </form>
  </aside>
{/if}

<ConfirmModal bind:this={confirmRef} />

{#if fixedScopeOpen}
  <button class="overlay" onclick={() => (fixedScopeOpen = false)} aria-label="Close"></button>
  <div class="fixed-scope-modal">
    <h3>Apply changes to this recurring transaction?</h3>
    <p>This is a recurring transaction — you can choose to apply these changes only on the selected month ({fixedScopeMonthLabel}) or from it onwards.</p>
    <div class="fixed-scope-actions">
      <button type="button" class="fixed-scope-btn primary" onclick={() => chooseFixedScope('onlyMonth')} disabled={saving}>Only in selected month</button>
      <button type="button" class="fixed-scope-btn" onclick={() => chooseFixedScope('onwards')} disabled={saving}>Selected month onwards</button>
    </div>
  </div>
{/if}

<style>
  :global(.local-menu) {
    position: fixed; z-index: 83; max-height: min(220px, 40vh); overflow-y: auto;
    padding: 6px; border: 1px solid var(--border); border-radius: 12px; background: var(--panel-strong);
    box-shadow: 0 18px 45px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.025);
  }
  :global(.local-menu button) {
    width: 100%; display: block; border: 0; border-radius: 8px; background: transparent; color: var(--text);
    padding: 9px 10px; font: inherit; font-size: 12px; text-align: left; cursor: pointer;
  }
  :global(.local-menu button:hover) { background: var(--border-soft); }
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
  .fixed-scope-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%,-50%);
    width: min(380px,calc(100% - 32px));
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    z-index: 61;
    padding: 20px;
    box-shadow: 0 24px 60px rgba(0,0,0,.5);
  }
  .fixed-scope-modal h3 {
    margin: 0 0 8px;
    font-size: 14.5px;
  }
  .fixed-scope-modal p {
    margin: 0 0 16px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .fixed-scope-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fixed-scope-btn {
    padding: 11px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel);
    color: var(--text);
    font: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .fixed-scope-btn:hover:not(:disabled) {
    border-color: var(--border-hover);
    background: var(--panel-strong);
  }
  .fixed-scope-btn.primary {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
  .fixed-scope-btn:disabled {
    opacity: .6;
    cursor: default;
  }
  .action-menu {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%,-50%);
    width: min(430px,calc(100% - 28px));
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 18px;
    z-index: 51;
    padding: 20px;
  }
  .action-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .action-heading h2 {
    margin: 2px 0 0;
    font-size: 21px;
  }
  .action-list {
    display: grid;
    gap: 8px;
    margin-top: 18px;
  }
  .action-list>button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 11px;
    border: 1px solid var(--border-soft);
    border-radius: 12px;
    background: var(--panel);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .action-list>button:hover {
    border-color: var(--border-hover);
    background: var(--card-hover);
  }
  .action-icon {
    width: 36px;
    height: 36px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .action-icon.expense {
    background: var(--negative-soft);
    color: var(--negative);
  }
  .action-icon.card {
    background: rgba(96,165,250,.16);
    color: #60a5fa;
  }
  .action-icon.income {
    background: var(--positive-soft);
    color: var(--positive);
  }
  .action-icon.transfer {
    background: rgba(245,158,11,.16);
    color: var(--planned);
  }
  .action-copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
  }
  .action-copy strong {
    font-size: 13px;
  }
  .action-copy small {
    color: var(--muted);
    font-size: 11px;
  }
  .selected-type {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 14px 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--panel);
    border: 1px solid var(--border-soft);
  }
  .selected-type>div {
    display: flex;
    flex: 1;
    flex-direction: column;
  }
  .selected-type>div span {
    color: var(--muted);
    font-size: 9px;
    text-transform: uppercase;
  }
  .selected-type>div strong {
    font-size: 13px;
  }
  .selected-type>button {
    border: 0;
    background: transparent;
    color: var(--accent);
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }
  .installment-banner {
    margin: 0 0 14px;
    padding: 12px;
    border-radius: 12px;
    background: var(--panel);
    border: 1px solid var(--border-soft);
  }
  .installment-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .installment-summary {
    display: grid;
    flex: 1;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .nav-arrow {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--border-soft);
    border-radius: 9px;
    background: var(--panel-strong);
    color: var(--text);
    cursor: pointer;
  }
  .nav-arrow:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .nav-arrow:disabled {
    opacity: .35;
    cursor: default;
  }
  .installment-summary div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .installment-summary div:last-child {
    text-align: right;
  }
  .installment-summary span {
    color: var(--muted);
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .installment-summary strong {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .installment-summary .group-total-field {
    margin-bottom: 0;
    gap: 2px;
  }
  .installment-summary .group-total-field :global(.amount-control) {
    border: 1px solid var(--border-soft);
    border-radius: 8px;
    background: var(--panel-strong);
    padding: 0;
    justify-content: flex-end;
  }
  .installment-summary .group-total-field :global(.amount-control:focus-within) {
    border-color: var(--accent);
  }
  .installment-summary .group-total-field :global(.amount-control b),
  .installment-summary .group-total-field :global(.stepper) {
    display: none;
  }
  .installment-summary .group-total-field :global(input) {
    width: 100%;
    padding: 5px 8px;
    font-size: 13px;
    font-weight: 700;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .installment-banner>small {
    display: block;
    margin-top: 9px;
    color: var(--muted);
    font-size: 9.5px;
  }
  .form-sheet {
    position: fixed;
    right: 0;
    top: 0;
    width: min(500px,100%);
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
    border-bottom: 1px solid var(--border-soft);
  }
  .form-heading h2 {
    margin: 2px 0 0;
    font-size: 24px;
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
  }
  .field input[type='month'] { color-scheme: dark; }
  .field input[type='number'] {
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .field input[type='number']::-webkit-inner-spin-button,
  .field input[type='number']::-webkit-outer-spin-button {
    margin: 0;
    -webkit-appearance: none;
  }
  .field input:focus, .field textarea:focus {
    border-color: var(--accent);
  }
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 12px;
  }
  .items-section {
    margin: 0 0 14px;
    border: 1px solid var(--border-soft);
    border-radius: 12px;
    background: var(--panel);
    overflow: hidden;
  }
  .items-section.open { border-color: color-mix(in srgb,var(--accent) 45%,var(--border-soft)); }
  .items-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border: 0;
    background: transparent;
    color: var(--text);
    padding: 11px 12px;
    text-align: left;
    cursor: pointer;
  }
  .items-toggle>span:first-child { display:flex; flex-direction:column; gap:2px; }
  .items-toggle strong { font-size:12px; }
  .items-toggle small, .items-footer small { color:var(--muted); font-size:9.5px; }
  .items-toggle-action { display:flex; align-items:center; gap:5px; color:var(--accent); font-size:10px; font-weight:800; white-space:nowrap; }
  .items-content { padding:0 12px 12px; }
  .item-row { padding:10px; border:1px solid var(--border-soft); border-radius:10px; background:var(--bg); }
  .item-row+.item-row { margin-top:8px; }
  .item-title { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; color:var(--muted); font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
  .item-title button { border:0; background:transparent; color:var(--faint); padding:3px; cursor:pointer; }
  .item-title button:hover { color:var(--negative); }
  .item-actions { display:flex; align-items:center; gap:8px; }
  .item-title .amount-action { color:var(--accent); font-size:9px; font-weight:800; letter-spacing:0; text-transform:none; }
  .item-title .amount-action:hover { color:var(--accent); text-decoration:underline; }
  .item-description { margin:0; }
  .optional-amount { display:flex; align-items:flex-end; justify-content:flex-end; gap:9px; margin-top:9px; padding-top:9px; border-top:1px solid var(--border-soft); }
  .item-amount { width:180px; margin:0; }
  .item-amount em { color:var(--faint); font-size:8px; font-style:normal; font-weight:600; text-transform:uppercase; }
  .optional-amount>button { border:0; background:transparent; color:var(--muted); padding:11px 3px; font-size:9px; cursor:pointer; }
  .optional-amount>button:hover { color:var(--negative); }
  .items-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-top:9px; }
  .items-footer button { border:0; background:transparent; color:var(--accent); font-size:10px; font-weight:800; cursor:pointer; white-space:nowrap; }
  .recurrence-details { display:grid; grid-template-columns:.8fr .8fr 1fr; gap:12px; padding:12px 12px 0; margin:-4px 0 14px; border:1px solid var(--border-soft); border-radius:10px; background:var(--panel); }
  .more-button {
    display: flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: transparent;
    color: var(--accent);
    padding: 5px 0 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .advanced {
    padding: 12px;
    border-radius: 12px;
    background: var(--panel);
    margin-bottom: 14px;
  }
  .check {
    display: block;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 12px;
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
  .submit-button:disabled { opacity: .6; cursor: default; }
  .form-error { display:flex; align-items:center; gap:6px; margin:0 0 12px; padding:9px 11px; border-radius:9px; background:var(--negative-soft); color:var(--negative); font-size:11.5px; font-weight:700; }
  .form-error :global(svg) { flex-shrink: 0; }
  .linked-account input { color: var(--muted); cursor: not-allowed; }
  .linked-account small { color: var(--faint); font-size: 9px; }
  .confirmed-row { display:flex; align-items:center; justify-content:space-between; margin: 2px 0 10px; padding: 10px 12px; border:1px solid var(--border-soft); border-radius:10px; background:var(--panel); }
  .confirmed-row span { display:flex; align-items:center; gap:7px; font-size:11px; font-weight:800; }
  .confirmed-row small { color:var(--muted); font-size:9.5px; }
  .form-footer { display:flex; align-items:center; justify-content:space-between; gap:16px; padding-top:4px; }
  .form-footer .check { margin:0; white-space:nowrap; }
  .form-footer .submit-button { width:auto; min-width:180px; }
  .delete-button { display:flex; align-items:center; gap:5px; border:1px solid var(--border-soft); border-radius:9px; background:transparent; color:var(--negative); padding:9px 13px; font-size:11.5px; font-weight:800; cursor:pointer; white-space:nowrap; }
  .delete-button:hover:not(:disabled) { border-color:var(--negative); background:var(--negative-soft); }
  .delete-button:disabled { opacity:.5; cursor:default; }

  @media(max-width:900px) {
    .action-menu {
      left: 0;
      top: auto;
      bottom: 0;
      transform: none;
      width: 100%;
      border-radius: 22px 22px 0 0;
      padding: 10px 18px 24px;
    }
    .action-menu .sheet-handle {
      display: block;
    }
    .overlay {
      display: none;
    }
    .form-sheet {
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 100%;
      max-height: none;
      border: 0;
      border-radius: 0;
      padding: 16px 18px calc(22px + env(safe-area-inset-bottom));
    }
    .field-grid {
      grid-template-columns: 1fr;
    }
    .form-footer { align-items:stretch; flex-direction:column; gap:10px; }
    .form-footer .submit-button { width:100%; }
    .confirmed-row { align-items:flex-start; flex-direction:column; gap:3px; }
    .optional-amount { align-items:stretch; flex-direction:column; }
    .item-amount { width:100%; }
    .optional-amount>button { align-self:flex-end; padding:2px 3px; }
    .recurrence-details { grid-template-columns:1fr 1fr; }
    .recurrence-details .field:last-child { grid-column:1 / -1; }
  }
  @media(min-width:901px) {
    .form-sheet {
      left: 50%;
      right: auto;
      top: 50%;
      width: min(620px,calc(100% - 40px));
      height: auto;
      max-height: 90vh;
      transform: translate(-50%,-50%);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px;
    }
  }
</style>
