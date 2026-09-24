<script>
  import Icon from '$lib/components/Icon.svelte';

  let { name = '', value = $bindable('0.00'), min = 0, step = 0.01, decimals = 2, prefix = 'R$', ariaLabel = 'Amount' } = $props();

  // Typed input may use a comma as the decimal separator (pt-BR keyboards,
  // numpads) — Number('10,50') is NaN, which used to silently collapse the
  // field back to 0.00 on blur. Normalize commas to dots before parsing.
  function toNumber(raw) {
    return Number(String(raw ?? '').replace(',', '.'));
  }
  function format(number) {
    return (Number.isFinite(number) ? number : 0).toFixed(decimals);
  }
  function normalize(number) {
    const bounded = Math.max(min, Number.isFinite(number) ? number : min);
    return bounded.toFixed(decimals);
  }
  function adjust(direction) { value = normalize(toNumber(value || 0) + direction * Number(step)); }
  function commit() { value = format(toNumber(value)); }

  let keypadOpen = $state(false);
  let entry = $state('0');
  let accumulator = $state(null);
  let pendingOp = $state(null);

  function trimZeros(number) {
    return String(Math.round(number * 100) / 100);
  }
  function openKeypad(event) {
    if (!window.matchMedia('(max-width: 900px)').matches) return;
    event.target.blur();
    entry = trimZeros(Number(value || 0));
    accumulator = null;
    pendingOp = null;
    keypadOpen = true;
  }
  function pressDigit(digit) {
    if (digit === '.' && entry.includes('.')) return;
    entry = entry === '0' && digit !== '.' ? digit : entry + digit;
  }
  function pressDel() {
    entry = entry.length > 1 ? entry.slice(0, -1) : '0';
  }
  function applyOp(a, op, b) {
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? a : a / b;
    return b;
  }
  function pressOp(op) {
    const current = Number(entry || 0);
    accumulator = accumulator !== null && pendingOp ? applyOp(accumulator, pendingOp, current) : current;
    pendingOp = op;
    entry = '0';
  }
  function pressEquals() {
    const current = Number(entry || 0);
    entry = trimZeros(applyOp(accumulator, pendingOp, current));
    accumulator = null;
    pendingOp = null;
  }
  function confirmKeypad() {
    if (accumulator !== null && pendingOp) {
      pressEquals();
      return;
    }
    value = normalize(Number(entry || 0));
    keypadOpen = false;
  }
  function cancelKeypad() {
    keypadOpen = false;
  }
</script>

<div class="amount-control">
  {#if prefix}<b>{prefix}</b>{/if}
  <input {name} inputmode="decimal" aria-label={ariaLabel} bind:value onfocus={openKeypad} onblur={commit} />
  <span class="stepper">
    <button type="button" aria-label={`Increase ${ariaLabel}`} onclick={() => adjust(1)}>+</button>
    <button type="button" aria-label={`Decrease ${ariaLabel}`} onclick={() => adjust(-1)}>−</button>
  </span>
</div>

{#if keypadOpen}
  <button class="keypad-overlay" onclick={cancelKeypad} aria-label="Close keypad"></button>
  <div class="keypad-sheet" role="dialog" aria-label={`${ariaLabel} keypad`}>
    <div class="keypad-handle"></div>
    <div class="keypad-display">
      {#if accumulator !== null && pendingOp}<small>{trimZeros(accumulator)} {pendingOp}</small>{/if}
      <strong class="money">{prefix} {entry}</strong>
    </div>
    <div class="keypad-body">
      <div class="keypad-numpad">
        <button type="button" onclick={() => pressDigit('7')}>7</button>
        <button type="button" onclick={() => pressDigit('8')}>8</button>
        <button type="button" onclick={() => pressDigit('9')}>9</button>
        <button type="button" onclick={() => pressDigit('4')}>4</button>
        <button type="button" onclick={() => pressDigit('5')}>5</button>
        <button type="button" onclick={() => pressDigit('6')}>6</button>
        <button type="button" onclick={() => pressDigit('1')}>1</button>
        <button type="button" onclick={() => pressDigit('2')}>2</button>
        <button type="button" onclick={() => pressDigit('3')}>3</button>
        <button type="button" onclick={() => pressDigit('.')}>.</button>
        <button type="button" onclick={() => pressDigit('0')}>0</button>
        <button type="button" class="confirm" aria-label={accumulator !== null && pendingOp ? 'Calculate' : 'Confirm amount'} onclick={confirmKeypad}>
          {#if accumulator !== null && pendingOp}=
          {:else}<Icon name="check" size={18} />{/if}
        </button>
      </div>
      <div class="keypad-divider"></div>
      <div class="keypad-ops">
        <button type="button" class="op" onclick={pressDel}>DEL</button>
        <button type="button" class="op" onclick={() => pressOp('÷')}>÷</button>
        <button type="button" class="op" onclick={() => pressOp('×')}>×</button>
        <button type="button" class="op" onclick={() => pressOp('−')}>−</button>
        <button type="button" class="op" onclick={() => pressOp('+')}>+</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .amount-control {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 28px;
    align-items: center;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--accent-panel);
    padding: 0 14px 0 0;
  }
  .amount-control:focus-within {
    border-color: var(--accent);
  }
  .amount-control b {
    padding-left: 14px;
    font-size: 13px;
  }
  .amount-control input {
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    padding: 13px 8px;
    font: inherit;
    font-size: 24px;
    font-weight: 800;
    outline: 0;
  }
  .stepper {
    display: grid;
    align-self: stretch;
    border-left: 1px solid var(--border-soft);
  }
  .stepper button {
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 11px;
    cursor: pointer;
  }
  .stepper button + button {
    border-top: 1px solid var(--border-soft);
  }
  .stepper button:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .keypad-overlay {
    position: fixed;
    inset: 0;
    border: 0;
    background: rgba(4, 5, 10, 0.72);
    backdrop-filter: blur(3px);
    z-index: 60;
  }
  .keypad-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 61;
    background: var(--bg);
    border-top: 1px solid var(--border);
    border-radius: 22px 22px 0 0;
    padding: 10px 14px calc(16px + env(safe-area-inset-bottom));
  }
  .keypad-handle {
    width: 36px;
    height: 4px;
    border-radius: 99px;
    background: var(--border-hover);
    margin: 0 auto 14px;
  }
  .keypad-display {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    padding: 0 6px 16px;
  }
  .keypad-display small {
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .keypad-display strong {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .keypad-body {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }
  .keypad-numpad {
    flex: 3;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .keypad-divider {
    width: 1px;
    background: var(--border-soft);
  }
  .keypad-ops {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .keypad-numpad button, .keypad-ops button {
    border: 0;
    border-radius: 13px;
    background: var(--panel);
    color: var(--text);
    font-weight: 700;
    cursor: pointer;
  }
  .keypad-numpad button {
    height: 54px;
    font-size: 19px;
  }
  .keypad-ops button {
    flex: 1;
    font-size: 16px;
  }
  .keypad-numpad button:active, .keypad-ops button:active {
    background: var(--accent-soft);
  }
  .keypad-ops button.op {
    color: var(--accent);
    font-weight: 800;
  }
  .keypad-numpad button.confirm {
    background: var(--positive);
    color: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (min-width: 901px) {
    .keypad-overlay,
    .keypad-sheet {
      display: none;
    }
  }
  @media (max-width: 900px) {
    .amount-control {
      grid-template-columns: auto minmax(0, 1fr);
      padding: 0 14px 0 0;
    }
    .stepper {
      display: none;
    }
  }
</style>
