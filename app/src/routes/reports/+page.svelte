<script>
  import Icon from '$lib/components/Icon.svelte';
  import FormSelect from '$lib/components/FormSelect.svelte';
  import FormDate from '$lib/components/FormDate.svelte';
  import FormCheckbox from '$lib/components/FormCheckbox.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar.js';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { transactions, visibleCreditCards, selectedMonth, monthLabel, changeMonth, installmentSiblings, bulkSetCategory, currentMonth } from '$lib/stores/finance.js';
  import TransactionFormModal from '$lib/components/TransactionFormModal.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  const fmt = (n) => `R$ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const catOf = (t) => t.category.split('·')[0].trim();
  const subOf = (t) => t.category.split('·')[1]?.trim() || '';
  const isInvoicePayment = (t) => catOf(t) === 'Credit cards' && subOf(t) === 'Invoice payment';
  let modalRef;
  let confirmRef;
  let tab = $state('filter'), reportType = $state('expense'), startDate = $state(`${$selectedMonth}-01`), endDate = $state(`${$selectedMonth}-31`), allTime = $state(true);
  let useEntryDate = $state(false), status = $state('all'), groupBy = $state('category'), viewType = $state('daily');
  let query = $state(''), category = $state('all'), subcategory = $state('all'), account = $state('all'), card = $state('all'), includeCardPurchases = $state(false);
  let showInvoicePayments = $state(false), groupInstallments = $state(true);
  let hideFixedPending = $state(true);
  let filterTab = $state('filters');

  // Bulk category re-assignment — moved here from Transactions because that
  // page is scoped to one month at a time, which made fixing a taxonomy
  // mistake across many transactions tedious; Reports' "All time" filter
  // (on by default) already spans everything, so it's the natural place.
  // Every row here already shares reportType (Expenses or Income), so
  // there's no mixed-type case to guard against like Transactions had.
  let selectMode = $state(false);
  let selectedIds = $state(new Set());
  function toggleSelectMode() {
    selectMode = !selectMode;
    selectedIds = new Set();
  }
  function toggleSelected(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next;
  }
  function toggleSelectAll() {
    if (sortedFiltered.length && sortedFiltered.every((item) => selectedIds.has(item.id))) selectedIds = new Set();
    else selectedIds = new Set(sortedFiltered.map((item) => item.id));
  }
  let bulkModalOpen = $state(false);
  let bulkCategory = $state('');
  let bulkSubcategory = $state('');
  let bulkSaving = $state(false);
  let bulkError = $state('');
  let savedFilters = $state([
    { id: 1, name: 'Monthly expenses', reportType: 'expense', status: 'all', groupBy: 'category', viewType: 'daily', category: 'all', subcategory: 'all', account: 'all', card: 'all', includeCardPurchases: false, query: '' },
    { id: 2, name: 'Pending income', reportType: 'income', status: 'pending', groupBy: 'none', viewType: 'daily', category: 'all', subcategory: 'all', account: 'all', card: 'all', includeCardPurchases: false, query: '' }
  ]);
  const typeMatched = $derived($transactions.filter((t) => (reportType === 'expense' ? (t.type === 'expense' || (includeCardPurchases && t.type === 'card')) : t.type === 'income') && (showInvoicePayments || !isInvoicePayment(t))));
  // Category/Subcategory dropdown options come from every transaction of the
  // report type, regardless of includeCardPurchases/showInvoicePayments — a
  // category shouldn't disappear from the picker just because the toggle
  // that reveals its transactions happens to be off (e.g. "Leisure ·
  // Games", bought on a card, vanished from the list with the default
  // "Include credit card purchases" off, looking like it didn't exist).
  const allOfType = $derived($transactions.filter((t) => reportType === 'expense' ? (t.type === 'expense' || t.type === 'card') : t.type === 'income'));
  const categories = $derived([...new Set(allOfType.map(catOf))].sort());
  const subcategories = $derived([...new Set(allOfType.filter((t) => category === 'all' || catOf(t) === category).map(subOf).filter(Boolean))].sort());
  const accounts = $derived([...new Set($transactions.map((t) => t.account).filter(Boolean))].sort());
  const bulkSubcategoryOptions = $derived(bulkCategory ? [...new Set(allOfType.filter((t) => catOf(t) === bulkCategory).map(subOf).filter(Boolean))].sort() : []);
  $effect(() => {
    if (bulkSubcategoryOptions.length && !bulkSubcategoryOptions.includes(bulkSubcategory)) bulkSubcategory = bulkSubcategoryOptions[0];
    else if (!bulkSubcategoryOptions.length) bulkSubcategory = '';
  });
  function openBulkCategory() {
    bulkError = '';
    bulkCategory = categories[0] || '';
    bulkModalOpen = true;
  }
  // A selected row collapsed from an installment group (groupInstallments
  // on) stands for every parcel of that purchase — expand it to all of
  // their real ids, same "the whole purchase" semantic the installment-group
  // PATCH edit already uses, instead of only re-categorizing the one row
  // SQL happens to store first.
  function expandedSelection() {
    const ids = new Set();
    for (const item of sortedFiltered) {
      if (!selectedIds.has(item.id)) continue;
      if (item.installmentGroupId) installmentSiblings(item.installmentGroupId).forEach((sib) => ids.add(sib.id));
      else ids.add(item.id);
    }
    return [...ids];
  }
  async function applyBulkCategory() {
    bulkSaving = true;
    bulkError = '';
    try {
      await bulkSetCategory(expandedSelection(), bulkCategory, bulkSubcategory);
      bulkModalOpen = false;
      selectMode = false;
      selectedIds = new Set();
    } catch (err) {
      bulkError = err.message || 'Failed to update.';
    } finally {
      bulkSaving = false;
    }
  }
  // `date` drives every downstream date use here (sort key, monthly
  // evolution bucketing, the table's date column, the earliest-date pick
  // for grouped installments below) — overriding it once here means the
  // entry/due toggle applies everywhere consistently instead of only to
  // the range filter.
  const filtered = $derived.by(() => $transactions.filter((t) => {
    const ref = useEntryDate ? (t.entryDate || t.dueDate) : t.dueDate, rightType = reportType === 'expense' ? (t.type === 'expense' || (includeCardPurchases && t.type === 'card')) : t.type === 'income';
    const itemsText = (t.items || []).map((i) => i.description).join(' ');
    const haystack = `${t.local} ${t.category} ${t.account || ''} ${itemsText}`.toLowerCase();
    return rightType && (showInvoicePayments || !isInvoicePayment(t)) && (!hideFixedPending || !(t.recurrence === 'fixed' && t.status === 'pending')) && (allTime || (ref >= startDate && ref <= endDate)) && (status === 'all' || t.status === status) && (category === 'all' || catOf(t) === category) && (subcategory === 'all' || subOf(t) === subcategory) && (account === 'all' || t.account === account) && (card === 'all' || t.cardId === card) && haystack.includes(query.toLowerCase());
  }).map((t) => ({ ...t, date: useEntryDate ? (t.entryDate || t.dueDate) : t.dueDate })));
  // Installments grouped by installmentGroupId collapse into one row (sum of
  // amount, earliest due date, "pending" if any parcel still is) for
  // display. The real first parcel stays reachable via _groupOriginal so
  // clicking it opens the edit modal on an actual transaction — never the
  // aggregate — and the this-installment / whole-purchase scope switch
  // already built into TransactionFormModal takes it from there.
  const displayRows = $derived.by(() => {
    if (!groupInstallments) return filtered;
    const groups = new Map();
    const rows = [];
    for (const item of filtered) {
      if (!item.installmentGroupId) { rows.push(item); continue; }
      const existing = groups.get(item.installmentGroupId);
      if (!existing) { groups.set(item.installmentGroupId, { original: item, amount: item.amount, count: 1, date: item.date, status: item.status }); continue; }
      existing.amount += item.amount;
      existing.count += 1;
      if (item.date < existing.date) existing.date = item.date;
      if (item.status === 'pending') existing.status = 'pending';
    }
    for (const g of groups.values()) rows.push({ ...g.original, amount: g.amount, date: g.date, status: g.status, local: `${g.original.local} (${g.count}x)`, _groupOriginal: g.original });
    return rows;
  });
  let sortKey = $state('date'), sortDir = $state('desc');
  const sortValue = (item, key) => key === 'account' ? (item.cardId ? cardName(item.cardId) : item.account) : key === 'category' ? catOf(item) : item[key];
  const sortedFiltered = $derived.by(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...displayRows].sort((a, b) => {
      const av = sortValue(a, sortKey), bv = sortValue(b, sortKey);
      return sortKey === 'amount' ? (av - bv) * dir : String(av).localeCompare(String(bv)) * dir;
    });
  });
  function toggleSort(key) {
    if (sortKey === key) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; return; }
    sortKey = key;
    sortDir = key === 'date' || key === 'amount' ? 'desc' : 'asc';
  }
  const total = $derived(filtered.reduce((s, t) => s + t.amount, 0));
  const executed = $derived(filtered.filter((t) => t.status === 'paid').reduce((s, t) => s + t.amount, 0));
  const pending = $derived(total - executed);
  const groups = $derived.by(() => {
    if (groupBy === 'none') return [];
    const all = filtered.reduce((acc, item) => { const key = groupBy === 'category' ? catOf(item) : (subOf(item) || 'Uncategorized'); acc[key] = (acc[key] || 0) + item.amount; return acc; }, {});
    return Object.entries(all).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  });
  const maxGroup = $derived(Math.max(1, ...groups.map((g) => g.value)));
  const evolution = $derived.by(() => {
    const months = filtered.reduce((acc, item) => { const key = item.date.slice(0, 7); acc[key] = (acc[key] || 0) + item.amount; return acc; }, {});
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, value }));
  });
  const maxEvolution = $derived(Math.max(1, ...evolution.map((item) => item.value)));
  function cardName(cardId) { return $visibleCreditCards.find((item) => item.id === cardId)?.name || 'Credit card'; }
  function useSaved(item) { ({ reportType, status, groupBy, viewType, category, account, query } = item); subcategory = item.subcategory || 'all'; includeCardPurchases = Boolean(item.includeCardPurchases); card = includeCardPurchases ? (item.card || 'all') : 'all'; startDate = `${$selectedMonth}-01`; endDate = `${$selectedMonth}-31`; allTime = true; tab = 'filter'; }
  async function removeSaved(item, event) {
    event.stopPropagation();
    const ok = await confirmRef.ask({ title: 'Delete this saved filter?', message: `"${item.name}" can't be recovered.`, confirmLabel: 'Delete' });
    if (!ok) return;
    savedFilters = savedFilters.filter((f) => f.id !== item.id);
  }
  function clearFilters() {
    allTime = true; startDate = `${$selectedMonth}-01`; endDate = `${$selectedMonth}-31`;
    useEntryDate = false; status = 'all'; category = 'all'; subcategory = 'all'; account = 'all';
    includeCardPurchases = false; card = 'all'; showInvoicePayments = false; groupInstallments = true; hideFixedPending = true; query = '';
  }
  function saveCurrent() { const name = query.trim() || `${reportType === 'expense' ? 'Expenses' : 'Income'} · ${includeCardPurchases && card !== 'all' ? cardName(card) : category === 'all' ? 'All categories' : category}`; savedFilters = [...savedFilters, { id: Date.now(), name, reportType, status, groupBy, viewType, category, subcategory, account, card, includeCardPurchases, query }]; tab = 'saved'; }
</script>

<svelte:head><title>Reports · MyFinance</title></svelte:head>

<PageHeader eyebrow="Analyze" title="Reports" stackedActions><div class="header-actions"><div class="month-nav"><button class="icon-btn" onclick={() => changeMonth(-1)} aria-label="Previous month"><Icon name="chevronLeft" size={15} /></button><button class="month-label" onclick={() => selectedMonth.set(currentMonth())} disabled={$selectedMonth === currentMonth()} title="Back to current month">{$monthLabel}</button><button class="icon-btn" onclick={() => changeMonth(1)} aria-label="Next month"><Icon name="chevronRight" size={15} /></button></div><button class="icon-btn" class:on={$privateMode} onclick={() => privateMode.update((v) => !v)} aria-label="Private mode"><Icon name="eye" size={18} /></button></div></PageHeader>
<main class="page-content">
  <div class="report-tabs"><button class:active={tab === 'filter'} onclick={() => tab = 'filter'}>Filter</button><button class:active={tab === 'saved'} onclick={() => tab = 'saved'}>Saved filters <span>{savedFilters.length}</span></button></div>
  {#if tab === 'saved'}
    <section class="g-card saved-card"><div class="section-title"><div><span class="eyebrow">Shortcuts</span><h2>Your saved reports</h2></div><p>Reuse the filters you consult most often.</p></div><div class="saved-list">{#each savedFilters as item}<div class="saved-item"><button onclick={() => useSaved(item)}><span class="saved-icon"><Icon name={item.reportType === 'expense' ? 'arrowUp' : 'arrowDown'} size={16} /></span><span><strong>{item.name}</strong><small>{item.reportType} · {item.status} · {item.groupBy === 'none' ? 'not grouped' : `by ${item.groupBy}`}</small></span><Icon name="chevronRight" size={16} /></button><button class="saved-delete" onclick={(event) => removeSaved(item, event)} aria-label="Delete saved filter"><Icon name="close" size={13} /></button></div>{/each}</div></section>
  {:else}
    <div class="workspace">
      <section class="g-card filter-card"><div class="type-switch"><button class:active={reportType === 'expense'} onclick={() => { reportType = 'expense'; category = 'all'; subcategory = 'all'; }}>Expenses</button><button class:active={reportType === 'income'} onclick={() => { reportType = 'income'; category = 'all'; subcategory = 'all'; card = 'all'; includeCardPurchases = false; }}>Income</button></div>
        <div class="tab-strip">
          <button class:active={filterTab === 'filters'} onclick={() => filterTab = 'filters'}>Filters</button>
          <button class:active={filterTab === 'category'} onclick={() => filterTab = 'category'}>Category</button>
          <button class:active={filterTab === 'options'} onclick={() => filterTab = 'options'}>Options{#if includeCardPurchases || showInvoicePayments || !groupInstallments || useEntryDate || !hideFixedPending} ●{/if}</button>
        </div>
        {#if filterTab === 'filters'}<div class="fields">
          <label class="wide card-toggle"><span><FormCheckbox bind:checked={allTime} ariaLabel="All time" /> All time</span><small>On by default: every transaction, regardless of date. Turn off to pick a range.</small></label>
          {#if !allTime}<div class="field-control"><span>Start date</span><FormDate name="startDate" bind:value={startDate} ariaLabel="Start date" /></div><div class="field-control"><span>End date</span><FormDate name="endDate" bind:value={endDate} ariaLabel="End date" /></div>{/if}
          <div class="field-control"><span>Status</span><FormSelect name="status" bind:value={status} ariaLabel="Status" options={[{ value: 'all', label: 'All' }, { value: 'paid', label: 'Confirmed' }, { value: 'pending', label: 'Pending' }]} /></div>
          <div class="field-control"><span>Group by</span><FormSelect name="groupBy" bind:value={groupBy} ariaLabel="Group by" options={[{ value: 'none', label: 'None' }, { value: 'category', label: 'Category' }, { value: 'subcategory', label: 'Subcategory' }]} /></div><div class="field-control"><span>View type</span><FormSelect name="viewType" bind:value={viewType} ariaLabel="View type" options={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly evolution' }]} /></div>
          <label class="wide"><span>Description</span><div class="search"><Icon name="search" size={14} /><input placeholder="Local, category, account or item" bind:value={query} /></div></label>
        </div>{:else if filterTab === 'category'}<div class="fields">
          <div class="field-control wide"><span>Category</span><FormSelect name="category" bind:value={category} ariaLabel="Category" options={[{ value: 'all', label: 'All categories' }, ...categories.map((item) => ({ value: item, label: item }))]} /></div>
          <div class="field-control wide"><span>Subcategory</span><FormSelect name="subcategory" bind:value={subcategory} ariaLabel="Subcategory" options={[{ value: 'all', label: 'All subcategories' }, ...subcategories.map((item) => ({ value: item, label: item }))]} /></div>
          <div class="field-control wide"><span>Account</span><FormSelect name="account" bind:value={account} ariaLabel="Account" options={[{ value: 'all', label: 'All accounts' }, ...accounts.map((item) => ({ value: item, label: item }))]} /></div>
        </div>{:else}<div class="fields">
          {#if reportType === 'expense'}<label class="wide card-toggle"><span><FormCheckbox bind:checked={includeCardPurchases} ariaLabel="Include credit card purchases" onchange={() => { if (!includeCardPurchases) card = 'all'; }} /> Include credit card purchases</span><small>Off by default: only expenses debited directly from accounts.</small></label>{/if}
          {#if reportType === 'expense' && includeCardPurchases}<div class="field-control wide"><span>Credit card</span><FormSelect name="card" bind:value={card} ariaLabel="Credit card" options={[{ value: 'all', label: 'All cards' }, ...$visibleCreditCards.map((item) => ({ value: item.id, label: item.name }))]} /></div>{/if}
          {#if reportType === 'expense'}<label class="wide card-toggle"><span><FormCheckbox bind:checked={showInvoicePayments} ariaLabel="Show invoice payments" /> Show invoice payments</span><small>Off by default: hides the lump-sum credit card invoice settlement, since its purchases already show up individually via "Include credit card purchases".</small></label>{/if}
          <label class="wide card-toggle"><span><FormCheckbox bind:checked={groupInstallments} ariaLabel="Group installments" /> Group installments</span><small>On by default: parcels from the same purchase collapse into one row with the total amount. Off: each parcel shows as its own row.</small></label>
          <label class="wide card-toggle"><span><FormCheckbox bind:checked={useEntryDate} ariaLabel="Use entry date" /> Use entry date instead of due date</span><small>Off by default: date range, sorting and grouping use the due date. Turn on to use the real transaction (entry) date instead.</small></label>
          <label class="wide card-toggle"><span><FormCheckbox bind:checked={hideFixedPending} ariaLabel="Hide pending fixed transactions" /> Hide pending fixed transactions</span><small>On by default: fixed monthly series are auto-materialized months ahead (e.g. through Dec 2028), so their future, still-pending occurrences would otherwise flood an "All time" report. Turn off to include them.</small></label>
        </div>{/if}
        <button class="clear-button" onclick={clearFilters}><Icon name="close" size={14} /> Clear filters</button>
        <button class="save-button" onclick={saveCurrent}><Icon name="check" size={14} /> Save current filter</button></section>
      <section class="results"><div class="metrics"><div><span>Confirmed</span><strong class="money">{fmt(executed)}</strong></div><div><span>Pending</span><strong class="money pending">{fmt(pending)}</strong></div><div class="total"><span>Total · {filtered.length} entries</span><strong class="money">{fmt(total)}</strong></div></div>
        {#if viewType === 'monthly' && evolution.length}<div class="g-card evolution"><div class="card-title"><h3>Monthly evolution</h3><span>{evolution.length} months</span></div><div class="evolution-bars">{#each evolution as item}<div><i><b style={`height:${Math.max(8,item.value / maxEvolution * 100)}%`}></b></i><span>{item.month.slice(5)}/{item.month.slice(2,4)}</span><strong class="money">{fmt(item.value)}</strong></div>{/each}</div></div>{:else if groups.length}<div class="g-card ranking"><div class="card-title"><h3>{groupBy === 'category' ? 'Category ranking' : 'Subcategory ranking'}</h3><span>{allTime ? 'All time' : `${startDate.slice(5)} → ${endDate.slice(5)}`}</span></div>{#each groups.slice(0, 6) as item}<div class="rank-row"><span>{item.name}</span><i><b style={`width:${item.value / maxGroup * 100}%`}></b></i><strong class="money">{fmt(item.value)}</strong></div>{/each}</div>{/if}
        <div class="g-card transaction-card"><div class="card-title"><h3>Report results</h3><div class="card-title-actions"><span>{sortedFiltered.length} {groupInstallments ? 'entries' : 'transactions'}</span><button class="select-toggle" class:on={selectMode} onclick={toggleSelectMode}><Icon name="check" size={13} /> {selectMode ? 'Cancel' : 'Select'}</button></div></div>
          {#if selectMode}
            <div class="bulk-bar">
              <span>{selectedIds.size} selected</span>
              <div class="bulk-actions">
                <button class="bulk-clear" disabled={!selectedIds.size} onclick={() => (selectedIds = new Set())}>Clear</button>
                <button class="bulk-category" disabled={!selectedIds.size} onclick={openBulkCategory}>Change category</button>
              </div>
            </div>
          {/if}
          <div class="result-list">
          {#if sortedFiltered.length}
          <table class="result-table">
            <thead><tr>
              <th class="col-status">{#if selectMode}<input type="checkbox" class="row-checkbox" checked={sortedFiltered.length > 0 && sortedFiltered.every((item) => selectedIds.has(item.id))} onclick={(event) => event.stopPropagation()} onchange={toggleSelectAll} aria-label="Select all" />{/if}</th>
              <th><button type="button" class:sorted={sortKey==='local'} onclick={() => toggleSort('local')}>Description{#if sortKey==='local'}<Icon name={sortDir==='asc'?'arrowUp':'arrowDown'} size={11} />{/if}</button></th>
              <th><button type="button" class:sorted={sortKey==='category'} onclick={() => toggleSort('category')}>Category{#if sortKey==='category'}<Icon name={sortDir==='asc'?'arrowUp':'arrowDown'} size={11} />{/if}</button></th>
              <th><button type="button" class:sorted={sortKey==='account'} onclick={() => toggleSort('account')}>Account{#if sortKey==='account'}<Icon name={sortDir==='asc'?'arrowUp':'arrowDown'} size={11} />{/if}</button></th>
              <th><button type="button" class:sorted={sortKey==='date'} onclick={() => toggleSort('date')}>{useEntryDate ? 'Entry date' : 'Due date'}{#if sortKey==='date'}<Icon name={sortDir==='asc'?'arrowUp':'arrowDown'} size={11} />{/if}</button></th>
              <th class="col-amount"><button type="button" class:sorted={sortKey==='amount'} onclick={() => toggleSort('amount')}>Amount{#if sortKey==='amount'}<Icon name={sortDir==='asc'?'arrowUp':'arrowDown'} size={11} />{/if}</button></th>
            </tr></thead>
            <tbody>
              {#each sortedFiltered as item (item.id)}
              <tr class="result-row" class:selected={selectMode && selectedIds.has(item.id)} tabindex="0" onclick={() => { if (selectMode) toggleSelected(item.id); else modalRef.openEdit(item._groupOriginal || item); }} onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (selectMode) toggleSelected(item.id); else modalRef.openEdit(item._groupOriginal || item); } }}>
                <td class="col-status">
                  {#if selectMode}
                    <input type="checkbox" class="row-checkbox" checked={selectedIds.has(item.id)} onclick={(event) => event.stopPropagation()} onchange={() => toggleSelected(item.id)} aria-label={selectedIds.has(item.id) ? 'Deselect transaction' : 'Select transaction'} />
                  {:else}
                    <span class={`status ${item.status}`}></span>
                  {/if}
                </td>
                <td class="col-main"><div>{item.local}</div>{#if item.items?.length}<div class="col-items">{item.items.map((i) => i.description).join(' · ')}</div>{/if}</td>
                <td class="col-muted">{item.category}</td>
                <td class="col-muted">{item.cardId ? cardName(item.cardId) : item.account}</td>
                <td class="col-muted">{new Date(`${item.date}T12:00:00`).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</td>
                <td class="col-amount money">{fmt(item.amount)}</td>
              </tr>
              {/each}
            </tbody>
          </table>
          {:else}<div class="empty"><Icon name="search" size={22} /><strong>No transactions match this report</strong><small>Try widening the date range or clearing a filter.</small></div>{/if}
        </div></div>
      </section>
    </div>
  {/if}
</main>
{#if bulkModalOpen}
  <button class="overlay" onclick={() => (bulkModalOpen = false)} aria-label="Close"></button>
  <div class="bulk-modal g-card" role="dialog" aria-label="Change category">
    <h3>Change category</h3>
    <p>Applies to {selectedIds.size} selected {selectedIds.size === 1 ? 'entry' : 'entries'}{#if groupInstallments}, expanded to every installment of a grouped purchase{/if}.</p>
    <div class="field"><span>Category</span><FormSelect bind:value={bulkCategory} options={categories} ariaLabel="Category" /></div>
    {#if bulkSubcategoryOptions.length}<div class="field"><span>Subcategory</span><FormSelect bind:value={bulkSubcategory} options={bulkSubcategoryOptions} ariaLabel="Subcategory" /></div>{/if}
    {#if bulkError}<p class="bulk-error">{bulkError}</p>{/if}
    <div class="bulk-modal-actions">
      <button type="button" class="cancel-button" onclick={() => (bulkModalOpen = false)} disabled={bulkSaving}>Cancel</button>
      <button type="button" class="confirm-button" onclick={applyBulkCategory} disabled={bulkSaving || !bulkCategory}>{bulkSaving ? 'Saving…' : 'Apply'}</button>
    </div>
  </div>
{/if}

<TransactionFormModal bind:this={modalRef} />
<ConfirmModal bind:this={confirmRef} />
<style>
.page-content{width:min(1120px,100%);margin:0 auto}.eyebrow{color:var(--accent);font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.icon-btn{width:36px;height:36px;border:0;border-radius:10px;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer}.icon-btn:hover,.icon-btn.on{background:var(--accent-soft);color:var(--accent)}.header-actions{display:flex;align-items:center;gap:6px;margin-left:auto}.month-nav{display:flex;align-items:center;gap:6px}.month-label{width:100px;padding:0 2px;border:0;background:transparent;color:var(--text);font:inherit;font-size:12px;font-weight:700;text-align:center;white-space:nowrap;cursor:pointer;border-radius:8px}.month-label:not(:disabled):hover{color:var(--accent)}.month-label:disabled{cursor:default}.page-content{padding:0 28px 42px}.report-tabs{display:flex;gap:5px;margin-bottom:12px}.report-tabs button,.type-switch button{border:0;border-radius:9px;background:transparent;color:var(--muted);padding:9px 13px;font-weight:800;cursor:pointer}.report-tabs button.active,.type-switch button.active{background:var(--accent-soft);color:var(--accent)}.report-tabs span{margin-left:4px;padding:1px 5px;border-radius:99px;background:var(--panel-strong);font-size:9px}.workspace{display:grid;grid-template-columns:330px minmax(0,1fr);gap:14px;align-items:start}.filter-card{padding:14px}.type-switch{display:grid;grid-template-columns:1fr 1fr;padding:4px;margin-bottom:14px;border-radius:11px;background:var(--panel-strong)}.fields{display:grid;grid-template-columns:1fr 1fr;gap:11px}.fields label{display:flex;min-width:0;flex-direction:column;gap:5px}.fields label>span{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase}.fields input{width:100%;min-width:0;border:1px solid var(--border-soft);border-radius:8px;background:var(--panel-strong);color:var(--text);padding:9px;outline:0}.fields input:focus{border-color:var(--accent)}.wide{grid-column:1/-1}.search{display:flex;align-items:center;gap:6px;border:1px solid var(--border-soft);border-radius:8px;padding-left:9px;background:var(--panel-strong);color:var(--muted)}.search input{border:0;background:transparent;padding-left:0}.save-button{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:8px;border:1px solid var(--border);border-radius:9px;background:transparent;color:var(--accent);padding:9px;font-weight:800;cursor:pointer}.clear-button{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:14px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--muted);padding:9px;font-weight:800;cursor:pointer}.clear-button:hover{color:var(--text);background:var(--panel-strong)}.results{display:flex;min-width:0;flex-direction:column;gap:12px;height:calc(100vh - 190px)}.metrics{display:grid;grid-template-columns:1fr 1fr 1.35fr;gap:1px;overflow:hidden;border:1px solid var(--border);border-radius:13px;background:var(--border)}.metrics div{padding:12px 14px;background:var(--card)}.metrics span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase}.metrics strong{display:block;margin-top:3px;font-size:14px}.metrics .pending{color:var(--planned)}.metrics .total{background:var(--accent-soft)}.metrics .total strong{color:var(--accent);font-size:16px}.ranking{padding-bottom:11px}.card-title{display:flex;align-items:center;justify-content:space-between;padding:13px 15px 9px}.card-title h3{margin:0;font-size:13px}.card-title span{color:var(--muted);font-size:10px}.rank-row{display:grid;grid-template-columns:110px 1fr 92px;align-items:center;gap:10px;padding:5px 15px;font-size:11px}.rank-row>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rank-row i{height:5px;border-radius:99px;background:var(--panel-strong)}.rank-row b{display:block;height:100%;border-radius:99px;background:var(--accent-solid)}.rank-row strong{text-align:right;font-size:11px}.transaction-card{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}.result-list{flex:1;min-height:0;overflow-y:auto}.result-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px}.result-table th:nth-child(3){width:150px}.result-table th:nth-child(4){width:130px}.result-table th:nth-child(5){width:76px}.result-table th:nth-child(6){width:100px}.result-table thead th{position:sticky;top:0;z-index:1;background:var(--card);padding:0;border-bottom:1px solid var(--border-soft);text-align:left}.result-table thead th.col-status{width:40px;padding:0 10px}.result-table thead th.col-amount{text-align:right}.result-table thead th button{display:inline-flex;align-items:center;gap:4px;width:100%;border:0;background:transparent;color:var(--muted);padding:10px 14px;font:inherit;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;cursor:pointer;text-align:inherit}.result-table thead th.col-amount button{justify-content:flex-end}.result-table thead th button:hover,.result-table thead th button.sorted{color:var(--accent)}.result-row{border-top:1px solid var(--border-soft);cursor:pointer}.result-row:hover{background:var(--accent-soft)}.result-row td{padding:9px 14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.result-row td.col-status{padding:9px 10px;overflow:visible;text-overflow:clip}.result-row td.col-main{font-weight:700}.result-row td.col-muted{color:var(--muted);font-size:11px}.result-row td.col-amount{text-align:right;font-weight:700}.status{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--positive)}.status.pending{background:var(--planned)}.col-items{margin-top:2px;font-size:10px;font-weight:400;color:var(--muted)}.empty{display:flex;align-items:center;flex-direction:column;gap:5px;padding:45px 20px;color:var(--muted);text-align:center}.empty strong{color:var(--text);font-size:12px}.empty small{font-size:10px}.saved-card{overflow:hidden}.section-title{display:flex;align-items:end;justify-content:space-between;padding:20px}.section-title h2{margin:3px 0 0;font-size:18px}.section-title p{margin:0;color:var(--muted);font-size:11px}.saved-list{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:0 20px 20px}.saved-item{position:relative}.saved-item>button:first-child{display:flex;align-items:center;gap:11px;width:100%;border:1px solid var(--border-soft);border-radius:12px;background:var(--panel);color:var(--text);padding:13px 34px 13px 13px;text-align:left;cursor:pointer}.saved-item>button:first-child:hover{border-color:var(--accent)}.saved-item>button:first-child>span:nth-child(2){display:flex;flex:1;flex-direction:column}.saved-list small{margin-top:3px;color:var(--muted);font-size:9px;text-transform:capitalize}.saved-delete{position:absolute;top:9px;right:9px;border:0;background:transparent;color:var(--faint);padding:6px;cursor:pointer;border-radius:7px}.saved-delete:hover{color:var(--negative);background:var(--negative-soft)}.saved-icon{display:flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:9px;background:var(--accent-soft);color:var(--accent)}
@media(max-width:900px){.month-nav{position:absolute;left:50%;bottom:10px;transform:translateX(-50%)}.page-content{padding:0 10px 30px}.workspace{grid-template-columns:1fr}.filter-card{padding:12px}.results{gap:9px;height:auto}.metrics div{padding:10px}.metrics strong{font-size:11px}.metrics .total strong{font-size:13px}.ranking{display:none}.transaction-card{flex:none;min-height:0}.result-list{flex:none;max-height:none}.result-table th:nth-child(3),.result-table th:nth-child(4),.result-table td:nth-child(3),.result-table td:nth-child(4){display:none}.result-table th:nth-child(5){width:60px}.saved-list{grid-template-columns:1fr;padding:0 12px 12px}.section-title{align-items:start;flex-direction:column;gap:5px;padding:16px 12px}.result-row{padding:11px}}
.card-toggle{padding:10px;border:1px solid var(--border-soft);border-radius:9px;background:var(--panel-strong)}.card-toggle>span{display:flex;align-items:center;gap:7px;color:var(--text)!important;text-transform:none!important}.card-toggle small{color:var(--muted);font-size:8.5px;line-height:1.35}.evolution{padding-bottom:12px}.evolution-bars{display:flex;height:112px;align-items:stretch;gap:8px;padding:4px 14px 0;overflow-x:auto}.evolution-bars>div{display:grid;grid-template-rows:1fr auto auto;min-width:58px;flex:1;gap:3px;text-align:center}.evolution-bars i{display:flex;align-items:end;justify-content:center;border-bottom:1px solid var(--border-soft)}.evolution-bars b{display:block;width:min(28px,70%);border-radius:5px 5px 0 0;background:var(--accent-solid)}.evolution-bars span{color:var(--muted);font-size:8px}.evolution-bars strong{font-size:8px}
.fields .field-control{display:flex;min-width:0;flex-direction:column;gap:5px}.fields .field-control>span{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase}.tab-strip{display:flex;gap:2px;margin:12px 0;background:var(--panel-strong);border-radius:9px;padding:3px}.tab-strip button{flex:1;border:0;background:transparent;color:var(--muted);padding:7px;border-radius:7px;font:inherit;font-weight:800;font-size:10.5px;cursor:pointer}.tab-strip button.active{background:var(--card);color:var(--accent)}

.card-title-actions{display:flex;align-items:center;gap:10px}
.select-toggle{display:flex;align-items:center;gap:5px;padding:0 10px;height:26px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--muted);font-size:10.5px;font-weight:700;cursor:pointer}
.select-toggle.on{background:var(--accent-soft);border-color:var(--accent-soft);color:var(--accent)}
.result-row.selected{background:var(--accent-soft)}
.row-checkbox{width:16px;height:16px;accent-color:var(--accent-solid);cursor:pointer}
.bulk-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 15px;border-bottom:1px solid var(--border-soft);background:var(--accent-panel);font-size:11.5px;font-weight:700}
.bulk-actions{display:flex;align-items:center;gap:8px}
.bulk-clear,.bulk-category{padding:6px 11px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:11px;font-weight:700;cursor:pointer}
.bulk-category{border-color:var(--accent-soft);background:var(--accent-soft);color:var(--accent)}
.bulk-clear:disabled,.bulk-category:disabled{opacity:.5;cursor:default}
.overlay{position:fixed;inset:0;border:0;background:rgba(4,5,10,.72);backdrop-filter:blur(3px);z-index:60}
.bulk-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px,calc(100% - 32px));z-index:61;padding:20px}
.bulk-modal h3{margin:0 0 6px;font-size:16px}
.bulk-modal p{margin:0 0 16px;color:var(--muted);font-size:12px}
.bulk-modal .field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.bulk-modal .field>span{font-size:11px;font-weight:700;color:var(--muted)}
.bulk-error{margin:-6px 0 12px;color:var(--negative);font-size:11px}
.bulk-modal-actions{display:flex;justify-content:flex-end;gap:8px}
.bulk-modal-actions .cancel-button,.bulk-modal-actions .confirm-button{padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:12px;font-weight:700;cursor:pointer}
.bulk-modal-actions .confirm-button{border-color:var(--accent-soft);background:var(--accent-soft);color:var(--accent)}
.bulk-modal-actions .confirm-button:disabled,.bulk-modal-actions .cancel-button:disabled{opacity:.6;cursor:default}
</style>
