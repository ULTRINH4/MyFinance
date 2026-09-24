import { writable } from 'svelte/store';

// Local-only UI preference (device-scoped, not linked to the user's row —
// unlike privateMode.js, nothing here needs to follow the user across devices).
const SHOW_CARD_TRANSACTIONS_KEY = 'myfinance-show-card-transactions';

function readBoolean(key, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === 'true';
  } catch {
    return fallback;
  }
}

// Default off: Transactions' Expense view shows the invoice as one line
// (plus non-card expenses) instead of every individual card purchase —
// turning this on switches back to one row per purchase.
export const showCardTransactions = writable(readBoolean(SHOW_CARD_TRANSACTIONS_KEY, false));

showCardTransactions.subscribe((value) => {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(SHOW_CARD_TRANSACTIONS_KEY, String(value)); } catch {}
});
