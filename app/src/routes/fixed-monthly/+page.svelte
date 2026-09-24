<script>
  import Icon from '$lib/components/Icon.svelte';
  import IconBadge from '$lib/components/IconBadge.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { fixedSeriesList, setFixedSeriesEndMonth, stopFixedSeries, FIXED_RECURRING_HORIZON } from '$lib/stores/finance.js';

  const fmt = (value) => `${value < 0 ? '-' : ''}R$ ${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const monthLabel = (month) => new Date(`${month}-02T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const todayStr = new Date().toISOString().slice(0, 10);

  let search = $state('');
  let selectedKey = $state(null);
  let mobileDetails = $state(false);

  const visibleSeries = $derived($fixedSeriesList.filter((s) => s.local.toLowerCase().includes(search.toLowerCase())));
  const selected = $derived($fixedSeriesList.find((s) => `${s.local}|${s.dbType}` === selectedKey) ?? visibleSeries[0] ?? $fixedSeriesList[0]);
  // A pending row in a month that's already past isn't "upcoming" like a
  // future one — it's a gap where a payment was skipped (e.g. paid Jan-Mar,
  // skipped Apr-Jun, resumed Jul: Apr/May/Jun sit here as overdue, not
  // "pending" like Jul-onwards would read). Same distinction Transactions'
  // Monthly details modal already draws (situation.overdue vs upcoming).
  const historyRows = $derived(
    selected
      ? selected.rows.map((row, i, all) => ({
          ...row,
          changedFrom: i > 0 && Number(all[i - 1].amount) !== Number(row.amount) ? all[i - 1].amount : null,
          displayStatus: row.status === 'paid' ? 'paid' : row.dueDate < todayStr ? 'overdue' : 'pending'
        }))
      : []
  );

  function selectSeries(series) {
    selectedKey = `${series.local}|${series.dbType}`;
    mobileDetails = true;
  }

  let endMonthDraft = $state('');
  let savingEndMonth = $state(false);
  let endMonthError = $state('');
  $effect(() => {
    endMonthDraft = selected?.endMonth || '';
    endMonthError = '';
  });

  async function saveEndMonth() {
    if (!selected) return;
    savingEndMonth = true;
    endMonthError = '';
    try {
      await setFixedSeriesEndMonth(selected.local, selected.dbType, endMonthDraft);
    } catch (err) {
      endMonthError = err.message || 'Failed to save.';
    } finally {
      savingEndMonth = false;
    }
  }

  let confirmRef = $state();
  async function stopSeries() {
    if (!selected) return;
    const ok = await confirmRef.ask({
      title: `Stop "${selected.local}"?`,
      message: 'Deletes every future/pending occurrence and removes it from this list. Everything already paid stays untouched in Transactions. To bring it back, flip it off directly in the database.',
      confirmLabel: 'Stop series'
    });
    if (!ok) return;
    try {
      await stopFixedSeries(selected.local, selected.dbType);
    } catch (err) {
      alert(err.message);
    }
  }

  $effect(() => {
    document.body.classList.add('fixed-monthly-page');
    return () => document.body.classList.remove('fixed-monthly-page');
  });
</script>

<svelte:head><title>Fixed monthly · MyFinance</title></svelte:head>

<PageHeader eyebrow="Manage" title="Fixed monthly" subtitle="Every recurring series, its linked account and how far it's set to run." stackedActions>
  <div class="header-actions">
    <button class="icon-btn" class:on={$privateMode} onclick={() => privateMode.update((v) => !v)} aria-label="Private mode"><Icon name="eye" size={18} /></button>
  </div>
</PageHeader>

<main class="page-content">
  <section class="series-shell g-card" class:show-details={mobileDetails}>
    <div class="catalog">
      <label class="search"><Icon name="search" size={15} /><input bind:value={search} aria-label="Search fixed series" placeholder="Search series" /></label>
      <div class="list-head"><span>{visibleSeries.length} series</span><span>Amount</span></div>
      <div class="series-list">
        {#each visibleSeries as series (series.local + series.dbType)}
          <button class:selected={selected === series} onclick={() => selectSeries(series)}>
            <IconBadge size={36} radius={11} background="var(--panel-strong)" color="var(--text)">{initials(series.local)}</IconBadge>
            <span class="series-main"><strong>{series.local}</strong><small>{series.category || 'Uncategorized'} · {series.account}</small></span>
            <span class="series-amount">
              <span class="money">{fmt(series.amount)}</span>
              <span class="end-tag" class:custom={series.hasCustomEndMonth}>
                {series.hasCustomEndMonth ? `Ends ${monthLabel(series.endMonth)}` : series.isCard ? `Card · until ${monthLabel(series.endMonth)}` : monthLabel(FIXED_RECURRING_HORIZON)}
              </span>
            </span>
            <Icon name="chevronRight" size={15} />
          </button>
        {:else}
          <div class="empty-state"><Icon name="search" size={22} /><strong>No fixed series found</strong><span>Try a different search.</span></div>
        {/each}
      </div>
    </div>

    {#if selected}
      <aside class="series-detail">
        <button class="back mobile-only" onclick={() => mobileDetails = false}><Icon name="chevronLeft" size={16} /> All series</button>
        <div class="detail-head">
          <IconBadge size={48} radius={14} background="var(--panel-strong)" color="var(--text)" fontSize={13}>{initials(selected.local)}</IconBadge>
          <div class="detail-title">
            <h2>{selected.local}</h2>
            <div class="detail-tags">
              <span class="tag">{selected.category || 'Uncategorized'}</span>
              <span class="tag account">{selected.account}</span>
              <span class="tag">{selected.type === 'income' ? 'Income' : selected.type === 'card' ? 'Card expense' : 'Expense'}</span>
            </div>
          </div>
        </div>

        <div class="detail-body">
          <div>
            <div class="section-label">Series settings</div>
            <div class="field-stack">
              <div class="field-row">
                <div class="field-copy"><strong>End month</strong><span>New occurrences stop generating after this month. {selected.isCard ? 'Card-linked series only auto-generate one month ahead — set a later month here if you want to plan further out.' : `Default is ${monthLabel(FIXED_RECURRING_HORIZON)}.`}</span></div>
                <div class="field-control">
                  <input class="month-input" type="month" bind:value={endMonthDraft} disabled={savingEndMonth} />
                  <button class="save-btn" onclick={saveEndMonth} disabled={savingEndMonth || endMonthDraft === selected.endMonth}>{savingEndMonth ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
              {#if endMonthError}<p class="field-error">{endMonthError}</p>{/if}
              <div class="field-row">
                <div class="field-copy"><strong>Stop this series</strong><span>Deletes future pending occurrences. Paid history stays untouched.</span></div>
                <button class="stop-btn" onclick={stopSeries}>Stop series</button>
              </div>
            </div>
          </div>

          <div>
            <div class="section-label">Value history</div>
            <div class="history-list">
              {#each historyRows as row (row.id)}
                <div class="history-row" class:future={row.displayStatus === 'pending'}>
                  <span class="history-month">{monthLabel(row.dueDate.slice(0, 7))}</span>
                  <span class="history-change">{#if row.changedFrom != null}was {fmt(Number(row.changedFrom))}{/if}</span>
                  <span class="status-chip" class:paid={row.displayStatus === 'paid'} class:pending={row.displayStatus === 'pending'} class:overdue={row.displayStatus === 'overdue'}>{row.displayStatus}</span>
                  <span class="history-amount money">{fmt(row.amount)}</span>
                </div>
              {/each}
            </div>
          </div>

          <p class="detail-note"><Icon name="list" size={15} /> To change the amount, category or account, edit any occurrence in Transactions and choose "Selected month onwards".</p>
        </div>
      </aside>
    {/if}
  </section>
</main>

<ConfirmModal bind:this={confirmRef} />

<style>
.page-content {
  width: min(1120px,100%);
  margin: 0 auto;
  padding: 0 28px 50px;
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
.series-shell {
  display: grid;
  grid-template-columns: minmax(360px,.85fr) minmax(420px,1.15fr);
  min-height: 620px;
  overflow: hidden;
}
.catalog {
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 14px 8px;
  padding: 9px 11px;
  border-radius: 10px;
  background: var(--panel);
  border: 1px solid var(--border-soft);
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
.search input::placeholder { color: var(--muted); }
.search:focus-within {
  border-color: var(--accent);
  background: var(--panel-strong);
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
.series-list {
  min-height: 0;
  overflow-y: auto;
}
.series-list button {
  width: 100%;
  display: grid;
  grid-template-columns: 36px 1fr auto 16px;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 0;
  border-top: 1px solid var(--border-soft);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.series-list button:hover, .series-list button.selected {
  background: linear-gradient(90deg,var(--accent-soft),transparent);
}
.series-main strong, .series-main small { display: block; }
.series-main strong { font-size: 12.5px; }
.series-main small { margin-top: 2px; color: var(--muted); font-size: 10px; }
.series-amount { text-align: right; }
.series-amount .money { display: block; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.end-tag {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 7px;
  border-radius: 99px;
  font-size: 9px;
  font-weight: 800;
  background: var(--panel-strong);
  color: var(--faint);
  border: 1px solid var(--border);
}
.end-tag.custom { background: rgba(201,154,69,.16); color: var(--planned); border-color: transparent; }
.series-list button > :global(svg) { color: var(--faint); }

.series-detail { padding: 28px 30px; overflow-y: auto; }
.detail-head { display: flex; align-items: flex-start; gap: 14px; }
.detail-title h2 { margin: 0 0 6px; font-size: 20px; }
.detail-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tag {
  padding: 3px 8px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
  background: var(--panel-strong);
  border: 1px solid var(--border);
  color: var(--muted);
}
.tag.account { color: var(--accent); border-color: var(--accent-soft); background: var(--accent-soft); }

.detail-body { display: flex; flex-direction: column; gap: 26px; margin-top: 26px; }
.section-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--faint);
  margin-bottom: 10px;
}
.field-stack { display: flex; flex-direction: column; gap: 10px; }
.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
}
.field-copy strong { display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 2px; }
.field-copy span { color: var(--muted); font-size: 11px; }
.field-control { display: flex; align-items: center; gap: 8px; }
.month-input {
  background: var(--panel-strong);
  border: 1px solid var(--border-hover);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-weight: 700;
  padding: 7px 10px;
}
.save-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--accent-soft);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
}
.save-btn:disabled { opacity: .5; cursor: default; }
.stop-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--negative-soft);
  background: transparent;
  color: var(--negative);
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
}
.stop-btn:hover { background: var(--negative-soft); }
.field-error { margin: -2px 2px 0; color: var(--negative); font-size: 11px; }

.history-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 12px;
  max-height: 360px;
  overflow-y: auto;
}
.history-row {
  display: grid;
  grid-template-columns: 90px 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--panel);
  font-size: 12px;
}
.history-row:last-child { border-bottom: 0; }
.history-row.future { background: var(--panel-strong); }
.history-month { font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
.history-change { font-size: 10px; color: var(--planned); }
.history-amount { font-variant-numeric: tabular-nums; font-weight: 700; text-align: right; }
.status-chip {
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  text-align: center;
}
.status-chip.paid { background: var(--positive-soft); color: var(--positive); }
.status-chip.pending { background: rgba(201,154,69,.16); color: var(--planned); }
.status-chip.overdue { background: var(--negative-soft); color: var(--negative); }

.detail-note {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 10px;
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
.empty-state strong { color: var(--text); font-size: 12px; }
.empty-state span { font-size: 10px; }
.mobile-only { display: none; }

@media(min-width:901px) {
  :global(body.fixed-monthly-page), :global(body.fixed-monthly-page .app-shell), :global(body.fixed-monthly-page .app-main) {
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }
  :global(body.fixed-monthly-page .app-main) {
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
  .series-shell {
    height: 100%;
    min-height: 0;
  }
  .catalog {
    min-height: 0;
  }
  .series-list {
    min-height: 0;
  }
  .series-detail {
    min-height: 0;
  }
}
@media(max-width:900px) {
  .page-content { padding: 0 8px 30px; }
  .series-shell {
    display: block;
    height: auto;
    min-height: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
  }
  .catalog { display: block; border: 0; }
  .series-detail { padding: 4px 0; }
  .series-list { display: flex; overflow: visible; flex-direction: column; gap: 8px; }
  .series-list button {
    border: 1px solid var(--border-soft);
    border-radius: 14px;
    background: var(--card);
    padding: 11px;
  }
  .series-detail { display: none; }
  .show-details .catalog { display: none; }
  .show-details .series-detail { display: block; }
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
  .field-row { flex-direction: column; align-items: flex-start; }
  .field-control { width: 100%; }
  .month-input { flex: 1; }
}
</style>
