<script>
  import PageHeader from '$lib/components/PageHeader.svelte';

  let { data } = $props();

  const sourceLabel = { app: 'App', import: 'Import', agent: 'Agent' };

  function fmt(n) {
    return `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
</script>

<svelte:head><title>Activity · MyFinance</title></svelte:head>

<PageHeader eyebrow="Dev only" title="Activity" subtitle="Last 150 transaction rows, most recent first — who/what wrote each one." />

<main class="page-content">
  <section class="g-card activity-list">
    <div class="activity-row activity-head">
      <span>Local</span>
      <span>Amount</span>
      <span>Source</span>
      <span>Created</span>
      <span>Updated</span>
    </div>
    {#each data.rows as row (row.id)}
      <div class="activity-row">
        <div class="activity-main">
          <span class="activity-local">{row.local || row.note || `#${row.id}`}</span>
          <span class="activity-meta">{row.type}{#if row.account} · {row.account}{/if}{#if row.cardName} · {row.cardName}{/if}</span>
        </div>
        <strong class="money">{fmt(row.amount)}</strong>
        <span class="source-pill" data-source={row.source}>{sourceLabel[row.source] || row.source}</span>
        <time>{fmtDate(row.createdAt)}</time>
        <time class:edited={row.edited}>{row.edited ? fmtDate(row.updatedAt) : '—'}</time>
      </div>
    {:else}
      <div class="empty">No transactions yet.</div>
    {/each}
  </section>
</main>

<style>
  .page-content {
    max-width: 1120px;
    margin: 0 auto;
    padding: 0 20px 40px;
  }
  .activity-list {
    padding: 8px;
    overflow-x: auto;
  }
  .activity-row {
    display: grid;
    grid-template-columns: 1.6fr 0.8fr 0.6fr 0.9fr 0.9fr;
    gap: 12px;
    align-items: center;
    padding: 11px 12px;
    border-bottom: 1px solid var(--border-soft);
    font-size: 12.5px;
    min-width: 640px;
  }
  .activity-row:last-child {
    border-bottom: 0;
  }
  .activity-head {
    color: var(--muted);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .activity-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .activity-local {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .activity-meta {
    color: var(--muted);
    font-size: 10.5px;
    text-transform: capitalize;
  }
  .source-pill {
    display: inline-block;
    width: fit-content;
    padding: 3px 8px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    background: var(--panel-strong);
    color: var(--muted);
  }
  .source-pill[data-source='app'] {
    background: var(--positive-soft);
    color: var(--positive);
  }
  .source-pill[data-source='agent'] {
    background: rgba(245, 158, 11, 0.16);
    color: var(--planned);
  }
  time {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  time.edited {
    color: var(--accent);
    font-weight: 700;
  }
  .empty {
    padding: 40px;
    text-align: center;
    color: var(--muted);
    font-size: 13px;
  }
  @media (max-width: 900px) {
    .page-content {
      padding: 0 14px 32px;
    }
  }
</style>
