<script>
  import { portal } from '$lib/portal.js';

  let { name, value = $bindable(''), options = [], disabled = false, ariaLabel = 'Select option' } = $props();
  let open = $state(false);
  let triggerEl;
  // Measured from the trigger when opened and used to position the
  // portalled menu — see portal.js for why this can't just be
  // position:absolute inside the card anymore.
  let menuRect = $state(null);

  function normalizedOptions() {
    return options.map((option) => typeof option === 'string' ? { value: option, label: option } : option);
  }
  function currentLabel() {
    return normalizedOptions().find((option) => option.value === value)?.label || 'Select';
  }
  function choose(option) {
    value = option.value;
    open = false;
  }
  function openMenu() {
    const rect = triggerEl.getBoundingClientRect();
    menuRect = { top: rect.bottom + 7, left: rect.left, width: rect.width };
    open = true;
  }
  function toggle() {
    if (open) open = false;
    else openMenu();
  }
  function handleKeydown(event) {
    const available = normalizedOptions();
    if (event.key === 'Escape') {
      open = false;
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const currentIndex = Math.max(0, available.findIndex((option) => option.value === value));
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      choose(available[(currentIndex + direction + available.length) % available.length]);
    }
  }
  $effect(() => {
    const available = normalizedOptions();
    if (available.length && !available.some((option) => option.value === value)) value = available[0].value;
  });
</script>

<div class="select-shell" class:open>
  <input type="hidden" {name} {value} />
  <button bind:this={triggerEl} class="select-trigger" type="button" {disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onclick={toggle} onkeydown={handleKeydown}>
    <span>{currentLabel()}</span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
  </button>
</div>

{#if open && menuRect}
  <div use:portal>
    <button class="select-dismiss" type="button" aria-label="Close options" onclick={() => (open = false)}></button>
    <div class="select-menu" role="listbox" aria-label={ariaLabel} style={`top:${menuRect.top}px;left:${menuRect.left}px;width:${menuRect.width}px`}>
      {#each normalizedOptions() as option}
        <button class:selected={option.value === value} type="button" role="option" aria-selected={option.value === value} onclick={() => choose(option)}>
          <span>{option.label}</span>
          {#if option.value === value}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>{/if}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .select-shell { position:relative; width:100%; }
  .select-trigger {
    width:100%; min-height:41px; display:flex; align-items:center; justify-content:space-between; gap:12px;
    border:1px solid var(--border-soft); border-radius:10px; background:var(--panel-strong); color:var(--text);
    padding:10px 12px; font:inherit; font-weight:600; text-align:left; cursor:pointer; outline:0;
  }
  .select-trigger:hover { border-color:var(--border-hover); }
  .select-trigger:focus-visible, .open .select-trigger { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
  .select-trigger:disabled { opacity:.52; cursor:not-allowed; }
  .select-trigger>span { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .select-trigger svg { width:14px; height:14px; flex:none; fill:none; stroke:var(--muted); stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; transition:transform .16s ease; }
  .open .select-trigger { position:relative; z-index:2; }
  .open .select-trigger svg { transform:rotate(180deg); }
  :global(.select-dismiss) { position:fixed; inset:0; z-index:80; border:0; background:rgba(4,5,10,.55); cursor:default; }
  :global(.select-menu) {
    position:fixed; z-index:83; max-height:min(240px,50vh); overflow-y:auto;
    padding:6px; border:1px solid var(--border); border-radius:12px; background:var(--panel-strong);
    box-shadow:0 18px 45px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.025);
  }
  :global(.select-menu button) {
    width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; border:0; border-radius:8px;
    background:transparent; color:var(--text); padding:9px 10px; font:inherit; font-size:12px; text-align:left; cursor:pointer;
  }
  :global(.select-menu button:hover) { background:var(--border-soft); }
  :global(.select-menu button.selected) { background:var(--accent-soft); color:var(--accent); font-weight:800; }
  :global(.select-menu button svg) { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.3; stroke-linecap:round; stroke-linejoin:round; }
  :global(.select-menu::-webkit-scrollbar) { width:7px; }
  :global(.select-menu::-webkit-scrollbar-thumb) { border:2px solid var(--panel-strong); border-radius:99px; background:var(--border-hover); }
</style>
