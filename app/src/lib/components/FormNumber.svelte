<script>
  let { name = '', value = $bindable('0'), min = 0, max = Infinity, step = 1, prefix = '', ariaLabel = 'Number', disabled = false } = $props();
  function normalize(number) {
    const bounded = Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
    const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
    return decimals ? bounded.toFixed(decimals) : String(Math.round(bounded));
  }
  function adjust(direction) { value = normalize(Number(value || 0) + direction * Number(step)); }
  function update(event) { value = event.currentTarget.value; }
  function commit() { value = normalize(Number(value)); }
</script>

<div class="number-control" class:disabled>
  {#if prefix}<span class="prefix">{prefix}</span>{/if}
  <input {name} {disabled} inputmode={Number(step) < 1 ? 'decimal' : 'numeric'} aria-label={ariaLabel} value={value} oninput={update} onblur={commit} />
  <span class="stepper"><button type="button" {disabled} aria-label={`Increase ${ariaLabel}`} onclick={() => adjust(1)}>+</button><button type="button" {disabled} aria-label={`Decrease ${ariaLabel}`} onclick={() => adjust(-1)}>−</button></span>
</div>

<style>
  .number-control{display:grid;grid-template-columns:auto minmax(0,1fr) 28px;min-width:0;min-height:41px;align-items:center;overflow:hidden;border:1px solid var(--border-soft);border-radius:10px;background:var(--panel-strong);transition:.15s}.number-control:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.number-control.disabled{opacity:.52}.prefix{padding-left:10px;color:var(--muted);font-size:9px;font-weight:800}.number-control input{width:100%;min-width:0;box-sizing:border-box;border:0;background:transparent;color:var(--text);padding:9px 8px;font:inherit;outline:0}.stepper{display:grid;align-self:stretch;border-left:1px solid var(--border-soft)}.stepper button{min-height:19px;border:0;background:transparent;color:var(--muted);font-size:10px;line-height:1;cursor:pointer}.stepper button+button{border-top:1px solid var(--border-soft)}.stepper button:hover:not(:disabled){background:var(--accent-soft);color:var(--accent)}
</style>
