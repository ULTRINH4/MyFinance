<script>
  let { name = '', value = $bindable(''), ariaLabel = 'Date', disabled = false, onchange } = $props();
  let open = $state(false);
  let viewYear = $state(2026);
  let viewMonth = $state(7);

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekdays = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function syncView() {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date();
    viewYear = date.getFullYear();
    viewMonth = date.getMonth();
  }
  function toggle() { if (disabled) return; if (!open) syncView(); open = !open; }
  function shiftMonth(offset) {
    const date = new Date(viewYear, viewMonth + offset, 1);
    viewYear = date.getFullYear(); viewMonth = date.getMonth();
  }
  function cells() {
    const first = new Date(viewYear, viewMonth, 1).getDay();
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - first + 1;
      return day > 0 && day <= count ? day : null;
    });
  }
  function choose(day) {
    value = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    open = false;
    onchange?.(value);
  }
  function selected(day) { return value === `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; }
  function displayValue() {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return match ? `${match[2]}/${match[3]}/${match[1]}` : 'mm/dd/yyyy';
  }
</script>

<div class="date-shell" class:open>
  <input type="hidden" {name} {value} />
  <button class="date-trigger" type="button" {disabled} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} onclick={toggle}>
    <span class:placeholder={!value}>{displayValue()}</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></svg>
  </button>
  {#if open}
    <button class="date-dismiss" type="button" aria-label="Close calendar" onclick={() => open = false}></button>
    <div class="date-menu" role="dialog" aria-label={`${ariaLabel} calendar`}>
      <header><button type="button" aria-label="Previous month" onclick={() => shiftMonth(-1)}>‹</button><strong>{months[viewMonth]} {viewYear}</strong><button type="button" aria-label="Next month" onclick={() => shiftMonth(1)}>›</button></header>
      <div class="weekdays">{#each weekdays as day}<span>{day}</span>{/each}</div>
      <div class="days">{#each cells() as day}{#if day}<button type="button" class:selected={selected(day)} aria-pressed={selected(day)} onclick={() => choose(day)}>{day}</button>{:else}<i></i>{/if}{/each}</div>
      <footer><button type="button" onclick={() => { value = ''; open = false; }}>Clear</button><button type="button" onclick={() => { const now = new Date(); viewYear = now.getFullYear(); viewMonth = now.getMonth(); choose(now.getDate()); }}>Today</button></footer>
    </div>
  {/if}
</div>

<style>
  .date-shell{position:relative;width:100%}.date-trigger{display:flex;width:100%;min-height:41px;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--border-soft);border-radius:10px;background:var(--panel-strong);color:var(--text);padding:10px 12px;font:inherit;font-weight:600;text-align:left;cursor:pointer;outline:0}.date-trigger:hover{border-color:var(--border-hover)}.date-trigger:focus-visible,.open .date-trigger{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.date-trigger:disabled{opacity:.52;cursor:not-allowed}.date-trigger span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.date-trigger .placeholder{color:var(--muted)}.date-trigger svg{width:15px;height:15px;flex:none;fill:none;stroke:var(--muted);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.open .date-trigger{position:relative;z-index:82}.date-dismiss{position:fixed;inset:0;z-index:80;border:0;background:transparent}.date-menu{position:absolute;top:calc(100% + 7px);right:0;z-index:83;width:258px;padding:9px;border:1px solid var(--border);border-radius:13px;background:var(--panel-strong);box-shadow:0 18px 45px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.025)}.date-menu header{display:grid;grid-template-columns:30px 1fr 30px;align-items:center;margin-bottom:7px}.date-menu header strong{text-align:center;font-size:11px}.date-menu button{border:0;background:transparent;color:var(--text);font:inherit;cursor:pointer}.date-menu header button{height:28px;border-radius:8px;color:var(--muted);font-size:20px}.date-menu header button:hover{background:var(--accent-soft);color:var(--accent)}.weekdays,.days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.weekdays span{padding:3px 0;color:var(--faint);font-size:7px;font-weight:800;text-align:center;text-transform:uppercase}.days button,.days i{display:flex;height:28px;align-items:center;justify-content:center;border-radius:8px;font-size:9px;font-style:normal}.days button:hover{background:var(--panel);color:var(--accent)}.days button.selected{background:var(--accent-solid);color:var(--bg);font-weight:900}.date-menu footer{display:flex;justify-content:space-between;margin-top:7px;padding-top:7px;border-top:1px solid var(--border-soft)}.date-menu footer button{padding:4px 6px;color:var(--accent);font-size:8px;font-weight:800}
  @media(max-width:900px){.date-menu{position:fixed;top:50%;left:50%;right:auto;width:min(310px,calc(100vw - 28px));transform:translate(-50%,-50%)}.days button,.days i{height:34px}}
</style>
