<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import IconBadge from '$lib/components/IconBadge.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar.js';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { categoryIcon } from '$lib/data/mock.js';
  import { transactions, visibleTransactions, selectedMonth, monthLabel, changeMonth, accountClosingAt, currentMonth } from '$lib/stores/finance.js';
  import { investmentAccounts } from '$lib/data/investments.js';

  const backHref = $page.url.searchParams.get('from') === 'summary' ? '/' : null;

  const catOf = (t) => t.category.split('·')[0].trim();
  const subOf = (t) => t.category.split('·')[1]?.trim() || '';

  const EXPENSE_COLORS = { Car:'#60a5fa', Clothing:'#c084fc', Food:'#f0b76d', Grocery:'#7fd18f', Leisure:'#a78bfa', Bills:'#8095e8', Subscriptions:'#5cc9c7', Payments:'#d1748b', Services:'#fb7185', Taxes:'#f59e0b', 'Credit cards':'#22d3ee', Others:'#94a3b8' };
  const INCOME_COLORS = { Salary:'#22c55e', Payments:'#34d399', Sales:'#2dd4bf', Investments:'#60a5fa', Services:'#a78bfa', Others:'#94a3b8' };
  const FALLBACK_PALETTE = ['#60a5fa', '#a78bfa', '#f0b76d', '#7fd18f', '#fb7185', '#5cc9c7', '#d1748b', '#94a3b8'];
  function colorFor(type, name) {
    const table = type === 'income' ? INCOME_COLORS : EXPENSE_COLORS;
    if (table[name]) return table[name];
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
  }

  // Category/subcategory lists come from every transaction ever (so a
  // category stays visible with R$0 in months it had no activity) — only
  // the VALUE is scoped to $selectedMonth via visibleTransactions. Mirrors
  // the same catOf/subOf split used in Reports.
  // A card purchase is client-side type 'card', not 'expense' (see
  // finance-data.js), so matching strictly on t.type === 'expense' silently
  // dropped every category/subcategory only ever bought on a card (Leisure ·
  // Games, Electronics...) — same class of bug already fixed for balances
  // in isAccountExpense.
  const matchesType = (t, type) => type === 'expense' ? (t.type === 'expense' || t.type === 'card') : t.type === type;
  function buildTypeGroups(type) {
    const catNames = [...new Set($transactions.filter((t) => matchesType(t, type)).map(catOf))].sort();
    return catNames.map((name) => {
      const children = [...new Set($transactions.filter((t) => matchesType(t, type) && catOf(t) === name).map(subOf).filter(Boolean))].sort();
      const value = $visibleTransactions.filter((t) => matchesType(t, type) && catOf(t) === name).reduce((sum, t) => sum + t.amount, 0);
      return { name, color: colorFor(type, name), value, children };
    });
  }

  const BANK_ACCOUNTS = ['Main Account', 'Secondary Account', 'Digital Wallet', 'Cash Wallet'];
  const bankValues = $derived(Object.fromEntries(BANK_ACCOUNTS.map((name) => [name, accountClosingAt(name, $selectedMonth)])));

  const groups = $derived({
    expenses: buildTypeGroups('expense'),
    income: buildTypeGroups('income'),
    // Bank balances are real and month-scoped; investment positions don't
    // have monthly history yet (own store, frontend-only) so they always
    // show the current value regardless of the month selected.
    accounts: [
      { name: 'Bank accounts', color: '#67b8f2', value: BANK_ACCOUNTS.reduce((sum, name) => sum + bankValues[name], 0), children: BANK_ACCOUNTS },
      { name: 'Investments', color: '#a78bfa', value: $investmentAccounts.reduce((sum, a) => sum + a.currentValue, 0), children: $investmentAccounts.map((a) => a.name) }
    ]
  });

  let activeTab = $state('expenses');
  let selectedName = $state('Car');
  let search = $state('');
  let mobileDetails = $state(false);
  const items = $derived(groups[activeTab]);
  const visibleItems = $derived(items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())));
  const selected = $derived(items.find((item) => item.name === selectedName) ?? items[0] ?? { name: '', color: 'var(--accent-solid)', value: 0, children: [] });
  const total = $derived(items.reduce((sum, item) => sum + item.value, 0));

  $effect(() => {
    document.body.classList.add('categories-page');
    return () => document.body.classList.remove('categories-page');
  });

  const fmt = (value) => `${value < 0 ? '-' : ''}R$ ${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const iconFor = (name) => categoryIcon[name] ?? ({ 'Credit cards': 'card', Salary: 'arrowDown', Sales: 'shapes', Investments: 'trending', 'Bank accounts': 'bank' }[name] || 'shapes');
  const childIcon = (name) => ({
    Fuel:'car', Wash:'shapes', Maintenance:'wrench', Shirts:'shirt', Chargebacks:'repeat', 'Invoice advance':'trending', 'Invoice payment':'card',
    Electronics:'bolt', Games:'ticket', Sports:'ticket', Travel:'ticket',
    Adjustments:'shapes',
    'Main Account':'bank', 'Secondary Account':'bank', 'Digital Wallet':'card', 'Cash Wallet':'card', 'Fixed Income':'trending', 'Brokerage':'trending'
  }[name] || 'shapes');
  // Bank balances (real, month-scoped) vs. investment positions (real, but
  // no monthly history yet) — see the `groups` derivation above.
  function valueForChild(child) {
    if (activeTab === 'accounts') {
      if (selected.name === 'Bank accounts') return bankValues[child] ?? 0;
      return $investmentAccounts.find((a) => a.name === child)?.currentValue ?? 0;
    }
    const type = activeTab === 'income' ? 'income' : 'expense';
    return $visibleTransactions.filter((t) => matchesType(t, type) && catOf(t) === selected.name && subOf(t) === child).reduce((sum, t) => sum + t.amount, 0);
  }
  const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;
  function transactionUrl(term = null) {
    const type = activeTab === 'accounts' ? 'statement' : activeTab === 'income' ? 'income' : 'expense';
    // Exact category/subcategory params, not `q` — a subcategory name alone
    // (e.g. "Others") isn't unique across categories, and `q` is just a
    // substring search over the combined "Category · Subcategory" text, so
    // it used to pull in every category's "Others" at once.
    if (activeTab === 'accounts') return `/transactions?type=statement&from=categories`;
    let url = `/transactions?type=${type}&category=${encodeURIComponent(selected.name)}&from=categories`;
    if (term) url += `&subcategory=${encodeURIComponent(term)}`;
    return url;
  }
  function selectTab(tab) {
    activeTab = tab;
    selectedName = groups[tab][0].name;
    mobileDetails = false;
    search = '';
  }
  function selectCategory(name) {
    selectedName = name;
    mobileDetails = true;
  }
</script>

<svelte:head><title>Categories · MyFinance</title></svelte:head>

<PageHeader eyebrow="Organization" title="Categories" subtitle="Explore monthly totals and jump directly to filtered transactions." backHref={backHref} stackedActions>
  <div class="header-actions">
    <div class="month-nav">
      <button class="icon-btn" onclick={() => changeMonth(-1)} aria-label="Previous month"><Icon name="chevronLeft" size={15} /></button>
      <button class="month-label" onclick={() => selectedMonth.set(currentMonth())} disabled={$selectedMonth === currentMonth()} title="Back to current month">{$monthLabel}</button>
      <button class="icon-btn" onclick={() => changeMonth(1)} aria-label="Next month"><Icon name="chevronRight" size={15} /></button>
    </div>
    <button class="icon-btn" class:on={$privateMode} onclick={() => privateMode.update((v) => !v)} aria-label="Private mode"><Icon name="eye" size={18} /></button>
  </div>
</PageHeader>

<main class="page-content">
  <section class="category-shell g-card" class:show-details={mobileDetails}>
    <div class="catalog">
      <nav class="category-tabs" aria-label="Category type">
        {#each ['expenses', 'income', 'accounts'] as tab}
          <button class:active={activeTab === tab} onclick={() => selectTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>
        {/each}
      </nav>
      <label class="search"><Icon name="search" size={15} /><input bind:value={search} aria-label="Search categories" placeholder="Search categories" /></label>
      <div class="list-head"><span>{plural(visibleItems.length, 'category', 'categories')}</span><span>Monthly total</span></div>
      <div class="category-list">
        {#each visibleItems as item}
          <button class:selected={selected.name === item.name} onclick={() => selectCategory(item.name)}>
            <IconBadge size={36} radius={11} background="color-mix(in srgb, {item.color} 18%, var(--panel))" color={item.color}><Icon name={iconFor(item.name)} size={17} /></IconBadge>
            <span class="category-name"><strong>{item.name}</strong><small>{plural(item.children.length, 'subcategory', 'subcategories')}</small></span>
            <span class="category-value money">{fmt(item.value)}</span>
            <Icon name="chevronRight" size={15} />
          </button>
        {:else}
          <div class="empty-state"><Icon name="search" size={22} /><strong>No categories found</strong><span>Try a different search.</span></div>
        {/each}
      </div>
    </div>

    <aside class="category-detail">
      <button class="back mobile-only" onclick={() => mobileDetails = false}><Icon name="chevronLeft" size={16} /> All categories</button>
      <div class="detail-head">
        <IconBadge size={54} radius={16} background="color-mix(in srgb, {selected.color} 18%, var(--panel))" color={selected.color}><Icon name={iconFor(selected.name)} size={24} /></IconBadge>
        <div><span>{activeTab === 'expenses' ? 'Expense' : activeTab === 'income' ? 'Income' : 'Account'} category</span><h2>{selected.name}</h2></div>
      </div>
      <div class="detail-total"><div><span>{activeTab === 'accounts' ? 'Current balance' : 'This month'}</span><strong class="money">{fmt(selected.value)}</strong><small>{total ? Math.round(selected.value / total * 100) : 0}% of {activeTab}</small></div><a href={transactionUrl()}>View transactions <Icon name="chevronRight" size={14} /></a></div>
      {#if selected.children.length}
      <div class="sub-head"><div><strong>Subcategories</strong><span>Use these to keep entries organized</span></div><span>{selected.children.length}</span></div>
      <div class="subcategory-list">
        {#each selected.children as child}
          <div><button onclick={() => goto(transactionUrl(child))} aria-label={`View transactions for ${child}`}><span class="child-icon" style="--category-color:{selected.color}"><Icon name={childIcon(child)} size={14} /></span><strong>{child}</strong><span class:negative={valueForChild(child) < 0} class="child-value money">{fmt(valueForChild(child))}</span><Icon name="chevronRight" size={15} /></button></div>
        {/each}
      </div>
      {/if}
      <p class="detail-note"><Icon name="list" size={15} /> Category editing will be enabled together with the transaction forms.</p>
    </aside>
  </section>
</main>

<style>
.page-content {
  width: min(1120px,100%);
  margin: 0 auto;
}
.icon-btn {
  width: 36px;
  height: 36px;
  margin-left: auto;
  flex-shrink: 0;
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
}
.category-shell {
  display: grid;
  grid-template-columns: minmax(420px,.92fr) minmax(420px,1.08fr);
  min-height: 620px;
  overflow: hidden;
}
.catalog {
  border-right: 1px solid var(--border);
}
.category-tabs {
  display: flex;
  gap: 5px;
  padding: 12px;
  border-bottom: 1px solid var(--border-soft);
}
.category-tabs button {
  flex: 1;
  border: 0;
  border-radius: 9px;
  padding: 9px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.category-tabs button.active {
  background: var(--accent-soft);
  color: var(--accent);
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 14px;
  padding: 9px 11px;
  border-radius: 10px;
  background: var(--input);
  color: var(--muted);
}
.search input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
}
.search input::placeholder {
  color: var(--muted);
}
.list-head {
  display: flex;
  justify-content: space-between;
  padding: 3px 18px 8px;
  color: var(--faint);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.category-list button {
  width: 100%;
  display: grid;
  grid-template-columns: 40px 1fr auto 16px;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 0;
  border-top: 1px solid var(--border-soft);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.category-list button:hover, .category-list button.selected {
  background: linear-gradient(90deg,var(--accent-soft),transparent);
}
.category-name strong, .category-name small {
  display: block;
}
.category-name strong {
  font-size: 13px;
}
.category-name small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}
.category-value {
  font-size: 12px;
  font-weight: 800;
}
.category-list button>:global(svg) {
  color: var(--faint);
}
.category-detail {
  padding: 28px 30px;
}
.detail-head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.detail-head span {
  color: var(--muted);
  font-size: 10px;
  text-transform: uppercase;
}
.detail-head h2 {
  margin: 2px 0 0;
  font-size: 22px;
}
.detail-total {
  margin: 24px 0;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: linear-gradient(135deg,var(--accent-soft),transparent);
}
.detail-total span, .detail-total small {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.detail-total strong {
  display: block;
  margin: 3px 0;
  font-size: 25px;
}
.sub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.sub-head>div strong, .sub-head>div span {
  display: block;
}
.sub-head strong {
  font-size: 13px;
}
.sub-head span {
  color: var(--muted);
  font-size: 10px;
}
.sub-head>span {
  padding: 4px 8px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 800;
}
.subcategory-list {
  border: 1px solid var(--border-soft);
  border-radius: 13px;
  overflow-y: auto;
}
.subcategory-list div {
  display: grid;
  grid-template-columns: 32px 1fr 16px;
  align-items: center;
  gap: 9px;
  padding: 11px 13px;
  border-top: 1px solid var(--border-soft);
}
.subcategory-list div:first-child {
  border: 0;
}
.subcategory-list strong {
  font-size: 12px;
}
.subcategory-list :global(svg) {
  color: var(--faint);
}
.child-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: color-mix(in srgb,var(--category-color) 14%,var(--panel));
  color: var(--category-color);
}
.detail-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 18px 2px 0;
  color: var(--muted);
  font-size: 10px;
}
.search {
  border: 1px solid var(--border-soft);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.015);
  transition: border-color var(--motion-duration),box-shadow var(--motion-duration),background var(--motion-duration);
}
.search:focus-within {
  border-color: var(--accent);
  background: var(--panel-strong);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.detail-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}
.detail-total a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 8px 10px;
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  text-decoration: none;
}
.subcategory-list div {
  display: block;
  padding: 0;
}
.subcategory-list button {
  width: 100%;
  display: grid;
  grid-template-columns: 32px 1fr auto 16px;
  align-items: center;
  gap: 9px;
  padding: 11px 13px;
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.subcategory-list button:hover {
  background: var(--accent-soft);
}
.subcategory-list button>:global(svg) {
  color: var(--faint);
}
.child-value {
  font-size: 11px;
  font-weight: 800;
}
.child-value.negative {
  color: var(--negative);
}
.empty-state {
  display: flex;
  min-height: 190px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  color: var(--muted);
  text-align: center;
}
.empty-state strong {
  color: var(--text);
  font-size: 12px;
}
.empty-state span {
  font-size: 10px;
}
.mobile-only {
  display: none;
}
@media(min-width:901px) {
  :global(body.categories-page), :global(body.categories-page .app-shell), :global(body.categories-page .app-main) {
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }
  :global(body.categories-page .app-main) {
    display: flex;
    flex-direction: column;
  }
  :global(.page-header) {
    flex-shrink: 0;
    padding-top: 18px;
    padding-bottom: 12px;
  }
  .page-content {
    flex: 1;
    min-height: 0;
    padding-bottom: 16px;
  }
  .category-shell {
    height: 100%;
    min-height: 0;
  }
  .catalog {
    display: flex;
    min-height: 0;
    flex-direction: column;
  }
  .category-list {
    min-height: 0;
    overflow-y: auto;
  }
  /* The shell is pinned to the viewport height above and clips overflow —
     .catalog/.category-list got their own scroll for that, but the detail
     pane (subcategory list) never did, so a category with enough
     subcategories to overflow just had the extra rows silently clipped
     with no way to reach them. Scrolling the whole pane would also drag
     the header/total off-screen with it, so instead .category-detail is a
     column that clips, and only .subcategory-list itself (flex: 1) scrolls
     — the head/total/note above and below it stay put.
  */
  .category-detail {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .detail-head, .detail-total, .sub-head, .detail-note {
    flex-shrink: 0;
  }
  .subcategory-list {
    min-height: 0;
    overflow-y: auto;
  }
}
@media(max-width:900px) {
  .month-nav {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
  }
  .page-content {
    padding: 0 8px 30px;
  }
  .category-shell {
    display: block;
    height: auto;
    min-height: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
  }
  .catalog {
    display: block;
    border: 0;
  }
  .category-tabs {
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: 13px;
    background: var(--panel);
  }
  .search {
    margin: 10px 0;
  }
  .list-head {
    padding: 4px 8px 8px;
  }
  .category-list {
    display: flex;
    overflow: visible;
    flex-direction: column;
    gap: 8px;
  }
  .category-list button {
    border: 1px solid var(--border-soft);
    border-radius: 14px;
    background: var(--card);
    padding: 11px;
  }
  .category-list button.selected {
    background: var(--card);
  }
  .category-detail {
    display: none;
    padding: 4px 0;
  }
  .show-details .catalog {
    display: none;
  }
  .show-details .category-detail {
    display: block;
  }
  .back {
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 0 0 14px;
    padding: 7px 2px;
    border: 0;
    background: transparent;
    color: var(--accent);
    font-weight: 800;
  }
  .detail-total {
    margin: 16px 0;
    padding: 15px;
  }
  .detail-total a {
    padding: 8px;
  }
  .category-value {
    font-size: 11px;
  }
  .detail-note {
    padding: 0 4px;
  }
}
</style>
