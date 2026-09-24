<script>
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import TransactionFormModal from '$lib/components/TransactionFormModal.svelte';
  import FormCheckbox from '$lib/components/FormCheckbox.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar.js';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { transactions, visibleCreditCards, selectedMonth, monthLabel, changeMonth, currentMonth } from '$lib/stores/finance.js';

  const fmt = (n) => `R$ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const signedFmt = (n) => `${n < 0 ? '-' : ''}${fmt(n)}`;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  let groupByDay = $state(false);
  let selectedDay = $state(today.getDate());
  let dayModalOpen = $state(false);
  let modalRef;

  function openDay(cell) {
    selectedDay = cell.day;
    if (window.matchMedia('(min-width: 901px)').matches) dayModalOpen = true;
  }
  function closeDayModal() {
    dayModalOpen = false;
  }

  onMount(() => {
    document.body.classList.add('calendar-page');
    return () => document.body.classList.remove('calendar-page');
  });

  const calendarCells = $derived.by(() => {
    const [year, month] = $selectedMonth.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const start = new Date(year, month - 1, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start); date.setDate(start.getDate() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return { key, day: date.getDate(), current: date.getMonth() === month - 1, date };
    });
  });

  function kindFor(transaction) {
    if (transaction.type === 'income') return 'income';
    if (transaction.type === 'transfer') return 'transfer';
    if (transaction.type === 'card') return 'card';
    return 'expense';
  }
  function itemsForCell(cell) {
    const list = $transactions.filter((t) => t.date === cell.key).map((t) => ({ kind: kindFor(t), label: t.local, amount: t.amount, status: t.status }));
    if (cell.current) for (const card of $visibleCreditCards) {
      if (card.closureDay === cell.day) list.push({ kind: 'closure', label: `${card.name} closes`, amount: null, status: 'paid' });
      if (card.dueDay === cell.day && !card.paid && card.invoice > 0) list.push({ kind: 'due', label: card.name, amount: card.invoice, status: 'pending' });
    }
    return list;
  }
  function grouped(items) {
    return ['expense', 'income', 'card', 'transfer'].map((kind) => ({ kind, value: items.filter((item) => item.kind === kind).reduce((sum, item) => sum + (item.amount || 0), 0) })).filter((item) => item.value > 0);
  }
  const isToday = (cell) => cell.key === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedKey = $derived(`${$selectedMonth}-${String(selectedDay).padStart(2, '0')}`);
  const selectedItems = $derived.by(() => itemsForCell({ key: selectedKey, day: selectedDay, current: true }));
  const selectedTotals = $derived(selectedItems.reduce((all, item) => { if (item.amount) all[item.kind] = (all[item.kind] || 0) + item.amount; return all; }, {}));
</script>

<svelte:head><title>Calendar · MyFinance</title></svelte:head>

<PageHeader eyebrow="Planning" title="Calendar" maxWidth="100%">
  <div class="header-actions">
    <button class="icon-btn" onclick={() => changeMonth(-1)} aria-label="Previous month"><Icon name="chevronLeft" size={15} /></button>
    <button class="month-label" onclick={() => selectedMonth.set(currentMonth())} disabled={$selectedMonth === currentMonth()} title="Back to current month">{$monthLabel}</button>
    <button class="icon-btn" onclick={() => changeMonth(1)} aria-label="Next month"><Icon name="chevronRight" size={15} /></button>
    <button class="icon-btn" class:on={$privateMode} onclick={() => privateMode.update((v) => !v)} aria-label="Private mode"><Icon name="eye" size={18} /></button>
  </div>
</PageHeader>

<main class="page-content">
  <section class="g-card calendar-card">
    <div class="calendar-toolbar"><strong>{$monthLabel}</strong><label>Group by day <FormCheckbox bind:checked={groupByDay} ariaLabel="Group by day" /></label></div>
    <div class="weekday-row">{#each weekdays as weekday}<span>{weekday}</span>{/each}</div>
    <div class="day-grid">
      {#each calendarCells as cell}
        {@const items = itemsForCell(cell)}
        <button class="day-cell" class:outside={!cell.current} class:today={isToday(cell)} class:selected={cell.current && selectedDay === cell.day} disabled={!cell.current} onclick={() => openDay(cell)} aria-label={cell.date.toLocaleDateString('en-US', { month:'long', day:'numeric' })}>
          <span class="day-num">{cell.day}</span>
          {#if groupByDay}
            <div class="group-list">{#each grouped(items) as item}<span class={item.kind}><b class="money">{fmt(item.value)}</b></span>{/each}</div>
          {:else if items.length}
            <div class="cell-dots">{#each items.slice(0, 5) as item}<i class={item.kind}></i>{/each}</div>
          {/if}
        </button>
      {/each}
    </div>
    <div class="legend"><span><i class="income"></i> Income</span><span><i class="expense"></i> Expense</span><span><i class="card"></i> Credit card</span><span><i class="transfer"></i> Transfer</span><span><i class="due"></i> Card due</span><span><i class="closure"></i> Card closes</span></div>
    <section class="mobile-summary">
      <div class="summary-heading"><strong>Transactions {selectedDay}/{Number($selectedMonth.slice(5,7))}/{String($selectedMonth.slice(2,4))}</strong><a href={`/transactions?date=${selectedKey}`}>View</a><button type="button" class="link-button" onclick={() => modalRef.openAdd('expense')}>Add</button></div>
      <div class="summary-lines"><span><i class="income"></i>Incomes <b class="income money">{fmt(selectedTotals.income || 0)}</b></span><span><i class="expense"></i>Expenses <b class="expense money">{fmt(selectedTotals.expense || 0)}</b></span><span><i class="card"></i>Credit cards <b class="card money">{fmt(selectedTotals.card || 0)}</b></span><span><i class="balance"></i>Balance <b class:negative={(selectedTotals.income || 0) - (selectedTotals.expense || 0) - (selectedTotals.card || 0) < 0} class="money">{signedFmt((selectedTotals.income || 0) - (selectedTotals.expense || 0) - (selectedTotals.card || 0))}</b></span><span><i class="transfer"></i>Transfers <b class="money">{fmt(selectedTotals.transfer || 0)}</b></span></div>
    </section>
  </section>
</main>

{#if dayModalOpen}
  <button class="overlay" onclick={closeDayModal} aria-label="Close day details"></button>
  <div class="day-modal g-card">
    <div class="day-modal-head">
      <div><span class="eyebrow">{$monthLabel}</span><h2>{new Date(`${selectedKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div>
      <button class="icon-btn" onclick={closeDayModal} aria-label="Close"><Icon name="close" size={18} /></button>
    </div>

    <div class="day-modal-list">
      {#each selectedItems as item}
        <div class="day-item">
          <i class={item.kind}></i>
          <span class="day-item-label">{item.label}</span>
          {#if item.amount !== null}<strong class="money">{fmt(item.amount)}</strong>{:else}<span></span>{/if}
          {#if item.status === 'paid'}<Icon name="check" size={13} />{:else}<span></span>{/if}
        </div>
      {:else}
        <div class="day-empty">No transactions on this day.</div>
      {/each}
    </div>

    <div class="day-modal-totals">
      <span><i class="income"></i>Income <b class="money">{fmt(selectedTotals.income || 0)}</b></span>
      <span><i class="expense"></i>Expenses <b class="money">{fmt(selectedTotals.expense || 0)}</b></span>
      <span><i class="card"></i>Card <b class="money">{fmt(selectedTotals.card || 0)}</b></span>
      <span><i class="transfer"></i>Transfers <b class="money">{fmt(selectedTotals.transfer || 0)}</b></span>
      <span class="balance"><i class="balance"></i>Balance <b class:negative={(selectedTotals.income || 0) - (selectedTotals.expense || 0) - (selectedTotals.card || 0) < 0} class="money">{signedFmt((selectedTotals.income || 0) - (selectedTotals.expense || 0) - (selectedTotals.card || 0))}</b></span>
    </div>

    <div class="day-modal-footer">
      <a href={`/transactions?date=${selectedKey}`}>View all in Transactions</a>
      <button type="button" onclick={() => { closeDayModal(); modalRef.openAdd('expense'); }}>+ Add transaction</button>
    </div>
  </div>
{/if}

<TransactionFormModal bind:this={modalRef} />

<style>
  .page-content{width:100%;margin:0 auto}.icon-btn{width:36px;height:36px;border:0;border-radius:10px;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer}.icon-btn:hover,.icon-btn.on{background:var(--accent-soft);color:var(--accent)}.header-actions{display:flex;align-items:center;gap:6px;margin-left:auto}.month-label{width:100px;padding:0 2px;border:0;background:transparent;color:var(--text);font:inherit;font-size:12px;font-weight:700;text-align:center;white-space:nowrap;cursor:pointer;border-radius:8px}.month-label:not(:disabled):hover{color:var(--accent)}.month-label:disabled{cursor:default}.page-content{height:calc(100dvh - 76px);padding:0 28px 20px}.calendar-card{display:flex;height:100%;min-height:0;flex-direction:column;overflow:hidden}.calendar-toolbar{display:flex;align-items:center;justify-content:space-between;min-height:42px;padding:0 14px;border-bottom:1px solid var(--border-soft)}.calendar-toolbar strong{font-size:12px}.calendar-toolbar label{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:10px;font-weight:700}.weekday-row{display:grid;grid-template-columns:repeat(7,1fr);flex-shrink:0;border-bottom:1px solid var(--border-soft);background:var(--panel-strong)}.weekday-row span{padding:6px;text-align:center;color:var(--faint);font-size:9px;font-weight:800;text-transform:uppercase}.day-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-template-rows:repeat(6,minmax(0,1fr));flex:1;min-height:0}.day-cell{position:relative;min-width:0;padding:8px;border-right:1px solid var(--border-soft);border-bottom:1px solid var(--border-soft);background:var(--panel)}.day-cell:nth-child(7n){border-right:0}.day-cell.outside{background:color-mix(in srgb,var(--panel) 55%,var(--bg));opacity:.46}.day-num{display:flex;width:22px;height:22px;align-items:center;justify-content:center;margin:0 auto 5px;border-radius:99px;color:var(--muted);font-size:10px;font-weight:700}.day-cell.today .day-num{background:var(--accent-solid);color:var(--bg)}.legend i{width:6px;height:6px;border-radius:99px}.legend .income{background:var(--positive)}.legend .expense{background:var(--negative)}.legend .card{background:#60a5fa}.legend .transfer{background:var(--planned)}.legend .due{background:#fbbf24}.legend .closure{background:var(--faint)}.group-list{display:flex;flex-direction:column;gap:4px;margin-top:2px}.group-list span{display:flex;height:17px;align-items:center;border-radius:4px;padding:0 6px}.group-list b{font-size:8.5px;font-weight:700}.group-list .expense{background:color-mix(in srgb,var(--negative) 78%,var(--panel));color:var(--bg)}.group-list .income{background:color-mix(in srgb,var(--positive) 72%,var(--panel));color:var(--bg)}.group-list .card{background:color-mix(in srgb,#60a5fa 78%,var(--panel));color:var(--bg)}.group-list .transfer{background:color-mix(in srgb,var(--planned) 78%,var(--panel));color:var(--bg)}.legend{display:flex;flex-wrap:wrap;gap:13px;min-height:37px;align-items:center;padding:0 14px}.legend span{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:9px}.mobile-only{display:none}
  @media(max-width:900px){.page-header{padding:16px 12px 10px}.page-header :global(.header-copy){display:none}.page-content{height:auto;padding:0 7px 18px}.calendar-card{height:auto;min-height:calc(100dvh - 72px)}.calendar-toolbar{padding:0 9px}.weekday-row span{font-size:7px}.day-grid{grid-template-rows:repeat(6,82px)}.day-cell{padding:4px 3px}.day-num{width:19px;height:19px;margin-bottom:3px;font-size:9px}.group-list{gap:2px}.group-list span{height:13px;padding:0 3px}.group-list b{font-size:7px}.legend{gap:8px;padding:8px 9px}.legend span{font-size:7px}}
  @media(min-width:901px) {
    .page-content { height: calc(100dvh - 94px); }
  }
  @media(max-width:900px) {
    .day-grid { grid-template-rows: repeat(6, 79px); }
    .calendar-card { min-height: calc(100dvh - 93px); }
  }
  :global(body.calendar-page) { height: 100dvh; overflow: hidden; }
  :global(body.calendar-page .app-shell), :global(body.calendar-page .app-main) { height: 100dvh; min-height: 0; overflow: hidden; }
  .day-cell { appearance: none; color: inherit; text-align: left; font: inherit; cursor: pointer; }
  .day-cell:disabled { cursor: default; }
  .mobile-summary { display: none; }
  .cell-dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-top: 5px; }
  .cell-dots i { width: 6px; height: 6px; border-radius: 50%; }
  .cell-dots i.income,.day-item i.income,.day-modal-totals i.income { background: var(--positive); }
  .cell-dots i.expense,.day-item i.expense,.day-modal-totals i.expense { background: var(--negative); }
  .cell-dots i.card,.day-item i.card,.day-modal-totals i.card { background: #60a5fa; }
  .cell-dots i.transfer,.day-item i.transfer,.day-modal-totals i.transfer { background: var(--planned); }
  .cell-dots i.due,.day-item i.due { background: #fbbf24; }
  .cell-dots i.closure,.day-item i.closure { background: var(--faint); }
  .day-modal-totals i.balance { background: var(--faint); }
  .overlay { position: fixed; inset: 0; border: 0; background: rgba(4,5,10,.72); backdrop-filter: blur(3px); z-index: 50; }
  .day-modal { position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%); width: min(460px, calc(100% - 32px)); max-height: 82vh; overflow-y: auto; z-index: 51; padding: 22px; }
  .day-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .day-modal-head h2 { margin: 2px 0 0; font-size: 19px; text-transform: capitalize; }
  .day-modal-head .eyebrow { color: var(--accent); font-size: 10px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
  .day-modal-list { margin-top: 16px; display: flex; flex-direction: column; gap: 2px; max-height: 280px; overflow-y: auto; }
  .day-item { display: grid; grid-template-columns: 8px 1fr auto auto; align-items: center; gap: 9px; padding: 9px 4px; border-bottom: 1px solid var(--border-soft); font-size: 12.5px; }
  .day-item i { width: 8px; height: 8px; border-radius: 50%; }
  .day-item-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .day-item strong { font-weight: 700; }
  .day-item :global(svg) { color: var(--positive); }
  .day-empty { padding: 24px 4px; color: var(--muted); font-size: 12px; text-align: center; }
  .day-modal-totals { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-soft); }
  .day-modal-totals span { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; }
  .day-modal-totals i { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .day-modal-totals b { margin-left: auto; color: var(--text); font-weight: 700; }
  .day-modal-totals b.negative { color: var(--negative); }
  .day-modal-totals .balance { grid-column: 1 / -1; }
  .day-modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; }
  .day-modal-footer a { color: var(--accent); font-size: 12px; font-weight: 700; text-decoration: none; }
  .day-modal-footer button { border: 0; border-radius: 11px; background: var(--accent-solid); color: var(--bg); padding: 10px 16px; font-weight: 800; cursor: pointer; }
  @media(min-width:901px) {
    .page-content { height: calc(100dvh - 94px); padding-bottom: 12px; }
    .day-cell { display: flex; flex-direction: column; align-items: center; border: 0; border-right: 1px solid var(--border-soft); border-bottom: 1px solid var(--border-soft); outline: 0; box-shadow: none; transition: background var(--motion-duration); }
    .day-cell:not(:disabled):hover { background: var(--card-hover); }
    .day-cell:not(:disabled):hover .day-num { color: var(--text); }
    .day-cell.today { background: color-mix(in srgb, var(--accent-solid) 7%, var(--panel)); }
    .day-cell.today:not(:disabled):hover { background: color-mix(in srgb, var(--accent-solid) 12%, var(--panel)); }
    .day-num { transition: color var(--motion-duration); }
  }
  @media(max-width:900px) {
    .page-header { height: 122px; padding: 15px 14px 9px; flex-wrap: wrap; }
    .page-header :global(h1) { margin: 0; font-size: 22px; }
    .page-header :global(.eyebrow) { display: none; }
    .header-actions { order: 4; width: 100%; margin: 5px 0 0; }
    .month-label { flex: 1; font-size: 15px; }
    .page-content { height: calc(100dvh - 122px); padding: 0 8px 8px; }
    .calendar-card { height: 100%; min-height: 0; border: 0; background: transparent; box-shadow: none; overflow: hidden; }
    .calendar-toolbar,.legend { display: none; }
    .weekday-row { background: transparent; border: 0; }
    .weekday-row span { padding: 7px 0 10px; color: var(--muted); font-size: 10px; font-weight: 600; text-transform: capitalize; }
    .day-grid { grid-template-rows: repeat(6, 48px); flex: none; }
    .day-cell { display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 2px; border: 0; background: transparent; }
    .day-cell.outside { visibility: hidden; }
    .day-num { width: 32px; height: 32px; margin: 0; font-size: 11px; }
    .day-cell.today .day-num { box-shadow: inset 0 0 0 1px var(--accent); background: transparent; color: var(--accent); }
    .day-cell.selected .day-num { background: var(--panel-strong); color: var(--text); box-shadow: none; }
    .group-list { display: none; }
    .cell-dots { justify-content: center; gap: 2px; height: 5px; margin-top: -3px; }
    .cell-dots i { width: 5px; height: 5px; }
    .summary-lines i { width: 5px; height: 5px; border-radius: 50%; }
    .summary-lines i.income { background: var(--positive); }
    .summary-lines i.expense { background: var(--negative); }
    .summary-lines i.card { background: #60a5fa; }
    .summary-lines i.transfer { background: var(--planned); }
    .mobile-summary { display: block; margin: 12px 8px 0; padding: 16px; border-radius: 20px; background: var(--panel-strong); }
    .summary-heading { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 22px; }
    .summary-heading strong { font-size: 13px; }
    .summary-heading a, .summary-heading .link-button { border: 0; background: transparent; padding: 0; font: inherit; color: var(--accent); font-size: 12px; font-weight: 800; text-decoration: none; cursor: pointer; }
    .summary-lines { display: grid; gap: 5px; margin-top: 14px; }
    .summary-lines span { display: grid; grid-template-columns: 7px 1fr auto; align-items: center; gap: 7px; color: var(--text); font-size: 11px; }
    .summary-lines b { font-size: 11px; font-weight: 600; }
    .summary-lines b.income { color: var(--positive); }
    .summary-lines b.expense,.summary-lines b.negative { color: var(--negative); }
    .summary-lines b.card { color: #60a5fa; }
    .summary-lines i.balance { background: var(--faint); }
  }
</style>
