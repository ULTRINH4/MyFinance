import { derived, get, writable } from 'svelte/store';
import { investmentAccounts } from '../data/investments.js';

// Populated by initFinance() from server-loaded data (see +layout.server.js /
// finance-data.js) once per session — these two stay plain mutable
// containers (not stores) so every derived store's closure over them below
// keeps seeing fresh contents after initFinance() mutates them in place.
export const availableMonths = [];
export const monthOpenings = {};
export const accountOpenings = {};
export const ignoredAccountNames = new Set();
let snapshot = null;

// The current calendar month, computed fresh on every call rather than once
// at module load — a frozen value here is exactly the bug this replaced
// (hardcoded to whatever month it was written in, silently wrong forever
// after that month ends, since a JS module only evaluates once).
export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
export const selectedMonth = writable(currentMonth());

// Default day for a new record's date fields: today's real day-of-month
// (not a hardcoded day), clamped to whatever month is actually selected
// (e.g. today is the 31st but the user is adding a record in a
// 30-day month).
export function todayDefaultDate(month) {
  const [year, m] = month.split('-').map(Number);
  const daysInMonth = new Date(year, m, 0).getDate();
  const day = Math.min(new Date().getDate(), daysInMonth);
  return `${month}-${String(day).padStart(2, '0')}`;
}
export const monthLabel = derived(selectedMonth, ($month) => new Date(`${$month}-02T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
export function changeMonth(step) {
  selectedMonth.update((month) => availableMonths[Math.max(0, Math.min(availableMonths.length - 1, availableMonths.indexOf(month) + step))]);
}

export const transactions = writable([]);
export const creditCardsStore = writable([]);
export const fixedSeriesSettingsStore = writable([]);
export const FIXED_RECURRING_HORIZON = '2028-12';

export function initFinance(data) {
  if (!data) return;
  availableMonths.length = 0;
  availableMonths.push(...data.availableMonths);
  for (const key of Object.keys(monthOpenings)) delete monthOpenings[key];
  Object.assign(monthOpenings, data.monthOpenings);
  for (const key of Object.keys(accountOpenings)) delete accountOpenings[key];
  Object.assign(accountOpenings, data.accountOpenings);
  ignoredAccountNames.clear();
  for (const name of data.ignoredAccountNames || []) ignoredAccountNames.add(name);
  transactions.set(data.transactions);
  creditCardsStore.set(data.cards);
  fixedSeriesSettingsStore.set(data.fixedSeriesSettings || []);
  investmentAccounts.set(data.investmentAccounts || []);
  snapshot = structuredClone(data);
  if (availableMonths.includes(currentMonth())) selectedMonth.set(currentMonth());
}

// One entry per fixed-monthly series (grouped by local+dbType — names are
// unique, so no need for the client to ever learn a localId). Grouped by
// `dbType`, the real Postgres enum value, never the display `type` (a card
// purchase displays as type='card' but is really type='expense' underneath —
// matching/settings must use the same key the server persists under, or a
// card-backed series silently never finds its own settings row). Archived
// (stopped) series are left out entirely — Settings has no "unstop" control
// on purpose, flip `fixed_series_settings.archived` back in Postgres instead.
// Used by /fixed-monthly to list every active series and drill into one's
// value history.
// Mirrors nextMonthStr() in finance-data.js — card-linked fixed series only
// materialize one month ahead (see ensureFixedRecurringMaterialized), so
// their default "runs until" badge should say that, not the far horizon.
function nextMonthStr() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 2;
  if (month > 12) { month -= 12; year += 1; }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export const fixedSeriesList = derived([transactions, fixedSeriesSettingsStore], ([$transactions, $settings]) => {
  const groups = new Map();
  for (const t of $transactions) {
    if (t.recurrence !== 'fixed' || !t.local) continue;
    const key = `${t.local}|${t.dbType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups.values()].map((rows) => {
    rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const latest = rows[rows.length - 1];
    const setting = $settings.find((s) => s.local === latest.local && s.type === latest.dbType);
    const isCard = Boolean(latest.cardId);
    return {
      local: latest.local,
      type: latest.type,
      dbType: latest.dbType,
      category: latest.category,
      account: latest.account,
      amount: latest.amount,
      nextDue: latest.dueDate,
      isCard,
      endMonth: setting?.endMonth || (isCard ? nextMonthStr() : FIXED_RECURRING_HORIZON),
      hasCustomEndMonth: Boolean(setting?.endMonth),
      archived: Boolean(setting?.archived),
      rows
    };
  }).filter((s) => !s.archived).sort((a, b) => a.local.localeCompare(b.local));
});
export const visibleTransactions = derived([transactions, selectedMonth], ([$transactions, $month]) => $transactions.filter((t) => t.date.startsWith($month)));
export const visibleCreditCards = derived([creditCardsStore, selectedMonth], ([$cards, $month]) => $cards.map((card) => ({ ...card, invoice: card.invoices[$month] || 0, nextInvoice: card.nextInvoices[$month] || 0, paid: card.paidMonths.includes($month), outstanding: card.outstandingBalance || 0 })));
export const pendingCardInvoices = derived([visibleCreditCards, selectedMonth], ([$cards, $month]) => $cards
  .filter((card) => !card.paid && card.invoice > 0)
  .map((card) => ({
    id: `invoice-${card.id}-${$month}`,
    type: 'invoice',
    status: 'pending',
    local: `Invoice · ${card.name}`,
    category: 'Credit card invoice',
    account: card.account,
    amount: card.invoice,
    date: `${$month}-${String(card.dueDay).padStart(2, '0')}`,
    dueDate: `${$month}-${String(card.dueDay).padStart(2, '0')}`,
    cardId: card.id,
    invoiceRecord: true
  })));

// Spending measures consumption: direct expenses and card purchases, never a
// settlement row.
export const isSpendingTransaction = (transaction) => ['expense', 'card'].includes(transaction.type) && !transaction.cardPayment;

// Account cash flow is trickier. Historically (and still, for any month
// that's only ever been "paid" through the due-date-passed heuristic —
// see paidMonths in finance-data.js): a card purchase debits its linked
// account directly once it's marked paid, and an invoice settlement row is
// excluded, to avoid double-counting the same spend twice. That's how the
// historically-imported data (source 'import') was reconciled against real
// bank statements — changing it broke real balances on 04/09/2026 (see git
// history / conversation log for that day).
//
// But once a real "Register payment" settlement exists for a card+month
// (source 'app', status 'paid'), the purchases underneath it are no longer
// the thing that hit the account — the lump-sum payment is. So for that
// specific card+month only, this now counts the settlement instead of the
// individual purchases. Months without such a settlement (the vast
// majority, all of history included) are completely unaffected — this only
// ever changes behavior for a card+month that went through Register payment
// after 04/09/2026.
function registeredCardMonths() {
  const cards = get(creditCardsStore);
  if (!cards.length) return null;
  const cardsByName = new Map(cards.map((c) => [c.name, c]));
  const set = new Set();
  for (const t of get(transactions)) {
    if (t.cardPayment && t.source === 'app' && t.status === 'paid' && t.dueDate) {
      const card = cardsByName.get(t.local);
      if (card) set.add(`${card.id}:${t.dueDate.slice(0, 7)}`);
    }
  }
  return set;
}
export const isAccountExpense = (transaction) => {
  if (transaction.type === 'card') {
    if (transaction.cardId != null && transaction.dueDate) {
      const months = registeredCardMonths();
      if (months?.has(`${transaction.cardId}:${transaction.dueDate.slice(0, 7)}`)) return false;
    }
    return true;
  }
  if (transaction.type === 'expense') return !transaction.cardPayment || transaction.source === 'app';
  return false;
};

// Category comes across the wire as a single "Cat · Sub" string — same split
// used by Reports/Categories, centralized here so the transaction form can
// build its category picker from the same real taxonomy instead of a
// hardcoded list that drifts from what's actually in Postgres.
export const catOf = (t) => t.category.split('·')[0].trim();
export const subOf = (t) => t.category.split('·')[1]?.trim() || '';

// "Credit cards" is a technical-only category (invoice settlement/advance,
// generated by payCard — see migrate-taxonomy.js) and never a pickable
// category in the transaction form.
export const taxonomy = derived(transactions, ($transactions) => {
  function build(type) {
    const map = {};
    // A card purchase is client-side type 'card', not 'expense' (see
    // finance-data.js) — matching t.type strictly dropped every category
    // only ever bought on a card (Leisure · Games...) from the form's
    // own picker, same class of bug already fixed in Categories/Reports.
    for (const t of $transactions) {
      const matches = type === 'expense' ? (t.type === 'expense' || t.type === 'card') : t.type === type;
      if (!matches) continue;
      const cat = catOf(t);
      if (cat === 'Credit cards') continue;
      const sub = subOf(t);
      (map[cat] ??= new Set());
      if (sub) map[cat].add(sub);
    }
    return Object.fromEntries(Object.entries(map).map(([cat, subs]) => [cat, [...subs].sort()]));
  }
  return { expense: build('expense'), income: build('income') };
});

// Per-account balance, real snapshot first (accountOpenings, straight from
// the bank statement) — same "never trust summed transactions alone"
// principle as the consolidated monthlyBalances below. Accounts with no
// statement ever imported (Digital Wallet, Cash Wallet) have no entry in
// accountOpenings at all and always read as flat R$0, matching how they
// actually work (pass-through wallets, invoice settles straight from the main
// Bank) — summing their transactions would just accumulate drift.
function accountMonthDelta(accountName, month) {
  const items = get(transactions).filter((t) => t.date.startsWith(month));
  const paidIncome = items.filter((t) => t.type === 'income' && t.account === accountName && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const paidExpenses = items.filter((t) => isAccountExpense(t) && t.account === accountName && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const creditedTransfers = items.filter((t) => t.type === 'transfer' && t.destinationAccount === accountName && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const debitedTransfers = items.filter((t) => t.type === 'transfer' && t.account === accountName && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  return paidIncome - paidExpenses + creditedTransfers - debitedTransfers;
}
export function accountOpeningAt(accountName, month) {
  if (!accountOpenings[accountName]) return 0;
  const real = accountOpenings[accountName][month];
  if (real !== undefined) return real;
  const idx = availableMonths.indexOf(month);
  if (idx <= 0) return 0;
  return accountClosingAt(accountName, availableMonths[idx - 1]);
}
export function accountClosingAt(accountName, month) {
  if (!accountOpenings[accountName]) return 0;
  const idx = availableMonths.indexOf(month);
  const nextMonth = availableMonths[idx + 1];
  const nextReal = nextMonth ? accountOpenings[accountName][nextMonth] : undefined;
  if (nextReal !== undefined) return nextReal;
  // Rounded to cents — summing floats (accountMonthDelta) can leave a
  // residue like -0.00000000001, which displays as "0.00" after
  // toLocaleString but still trips `< 0` checks (red/negative styling on
  // an account that's really at zero).
  const raw = accountOpeningAt(accountName, month) + accountMonthDelta(accountName, month);
  return Math.round(raw * 100) / 100;
}

export const transactionSummary = derived([visibleTransactions, visibleCreditCards, pendingCardInvoices, transactions], ([$transactions, $visibleCreditCards, $pendingCardInvoices, $allTransactions]) => {
  // Granular (one row per card purchase) — right for the category breakdown,
  // where each purchase's own category matters.
  const expenses = $transactions.filter(isSpendingTransaction);
  const incomes = $transactions.filter((t) => t.type === 'income');
  const pendingIncomes = incomes.filter((t) => t.status === 'pending');

  // "Pending expenses" (Monthly plan card, Expenses overview row) has to
  // count the way Transactions does by default: one line per unpaid card
  // invoice, not one per purchase inside it — otherwise a 30-purchase
  // invoice inflates the pending count to 30 instead of 1. Direct (non-card)
  // expenses still count individually as before. The invoice total (paid or
  // not) still has to be part of the month's total spend, or a paid card
  // would silently vanish from "Expenses" once its invoice is settled.
  // cardPayment settlements excluded here too — their invoice is already
  // counted via allInvoicesTotal below, same "settles, doesn't add" rule as
  // isAccountExpense/accountClosingAt.
  const directExpenses = $transactions.filter((t) => t.type === 'expense' && !t.cardPayment);
  const pendingDirect = directExpenses.filter((t) => t.status === 'pending');
  const paidDirectTotal = directExpenses.filter((t) => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const allInvoicesTotal = $visibleCreditCards.reduce((s, c) => s + c.invoice, 0);
  const pendingInvoicesTotal = $pendingCardInvoices.reduce((s, t) => s + t.amount, 0);

  const categoryColors = { Food:'var(--c-food)', Grocery:'var(--c-grocery)', Leisure:'var(--c-leisure)', Car:'var(--c-car)', Bills:'var(--c-bills)', Subscriptions:'var(--c-subs)', Payments:'var(--c-payments)', Services:'var(--c-services)' };
  const grouped = expenses.reduce((items, item) => { const name=item.category.split('·')[0].trim(); items[name]=(items[name]||0)+item.amount; return items; }, {});
  const pendingExpensesTotal = pendingDirect.reduce((s,t)=>s+t.amount,0) + pendingInvoicesTotal;
  const paidIncomesTotal = incomes.filter((t) => t.status === 'paid').reduce((s,t)=>s+t.amount,0);
  return {
    expenses:{
      total: paidDirectTotal + pendingDirect.reduce((s,t)=>s+t.amount,0) + allInvoicesTotal,
      executed: paidDirectTotal + (allInvoicesTotal - pendingInvoicesTotal),
      pending: pendingExpensesTotal,
      count: pendingDirect.length + $pendingCardInvoices.length
    },
    incomes:{ total:incomes.reduce((s,t)=>s+t.amount,0), executed:paidIncomesTotal, pending:pendingIncomes.reduce((s,t)=>s+t.amount,0), count:pendingIncomes.length },
    // Not month-filtered on purpose — early in a new month there may be no
    // paid expenses yet for it, and the feed would otherwise go blank
    // instead of showing whatever was actually paid most recently.
    latestExpenses:$allTransactions.filter((t)=>isSpendingTransaction(t)&&t.status==='paid').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5),
    categorySpend:Object.entries(grouped).map(([name,value])=>({name,value,color:categoryColors[name]||'var(--c-others)'})).sort((a,b)=>b.value-a.value).slice(0,5)
  };
});
export const cardTotals = derived(visibleCreditCards, ($cards) => ({ current:$cards.reduce((s,c)=>s+c.invoice,0), next:$cards.reduce((s,c)=>s+c.nextInvoice,0) }));

// Each month's opening/closing balance comes straight from real bank
// statement snapshots (monthOpenings, populated per-month by finance-data.js
// from account_balances) whenever we have one — a month's real closing
// balance is just next month's real opening. Only months outside that real
// range (nothing precedes the first snapshot, nothing follows the last)
// fall back to accumulating from paid income/expenses.
// A transfer between two tracked (non-ignored) accounts nets to zero in the
// consolidated total and needs no adjustment. One that crosses the boundary
// into/out of an ignored account (e.g. a real PIX to Digital Wallet) actually moves
// money out of/into the tracked pool and must shift the total accordingly —
// otherwise it silently vanishes from Current Balance while still correctly
// debiting the sending account on the Accounts page.
function crossBoundaryTransferAdjustment(items, status) {
  return items.filter((t) => t.type === 'transfer' && t.status === status).reduce((sum, t) => {
    const fromIgnored = ignoredAccountNames.has(t.account);
    const toIgnored = ignoredAccountNames.has(t.destinationAccount);
    if (!fromIgnored && toIgnored) return sum - t.amount;
    if (fromIgnored && !toIgnored) return sum + t.amount;
    return sum;
  }, 0);
}

const monthlyBalances = derived(transactions, ($transactions) => {
  let opening = monthOpenings[availableMonths[0]] || 0;
  const map = {};
  for (let i = 0; i < availableMonths.length; i++) {
    const m = availableMonths[i];
    const nextMonth = availableMonths[i + 1];
    if (monthOpenings[m] !== undefined) opening = monthOpenings[m];
    let current;
    if (nextMonth && monthOpenings[nextMonth] !== undefined) {
      current = monthOpenings[nextMonth];
    } else {
      const items = $transactions.filter((t) => t.date.startsWith(m));
      const paidIncome = items.filter((t) => t.type === 'income' && t.status === 'paid' && !ignoredAccountNames.has(t.account)).reduce((s, t) => s + t.amount, 0);
      const paidExpenses = items.filter((t) => isAccountExpense(t) && t.status === 'paid' && !ignoredAccountNames.has(t.account)).reduce((s, t) => s + t.amount, 0);
      current = opening + paidIncome - paidExpenses + crossBoundaryTransferAdjustment(items, 'paid');
    }
    map[m] = { opening, current };
    opening = current;
  }
  return map;
});

export const balanceState = derived([visibleTransactions, monthlyBalances, selectedMonth], ([$transactions,$monthly,$month]) => {
  const opening=$monthly[$month]?.opening ?? 0;
  const paidIncome=$transactions.filter((t)=>t.type==='income'&&t.status==='paid'&&!ignoredAccountNames.has(t.account)).reduce((s,t)=>s+t.amount,0);
  const paidExpenses=$transactions.filter((t)=>isAccountExpense(t)&&t.status==='paid'&&!ignoredAccountNames.has(t.account)).reduce((s,t)=>s+t.amount,0);
  const pendingIncome=$transactions.filter((t)=>t.type==='income'&&t.status==='pending'&&!ignoredAccountNames.has(t.account)).reduce((s,t)=>s+t.amount,0);
  const pendingExpenses=$transactions.filter((t)=>isAccountExpense(t)&&t.status==='pending'&&!ignoredAccountNames.has(t.account)).reduce((s,t)=>s+t.amount,0);
  const paidTransfers=$transactions.filter((t)=>t.type==='transfer'&&t.status==='paid').reduce((s,t)=>s+t.amount,0);
  const transferAdjustment=crossBoundaryTransferAdjustment($transactions,'paid');
  const pendingTransferAdjustment=crossBoundaryTransferAdjustment($transactions,'pending');
  const current=$monthly[$month]?.current ?? (opening+paidIncome-paidExpenses+transferAdjustment);
  const estimated=current+pendingIncome-pendingExpenses+pendingTransferAdjustment;
  return { opening,current,estimated,details:{openingBalance:opening,executedRevenues:paidIncome,creditedTransfers:paidTransfers,debitedTransfers:paidTransfers,executedExpenses:paidExpenses,currentBalance:current,pendingRevenue:pendingIncome,pendingExpenses,estimatedBalance:estimated} };
});

// Compares the current month against the previous one for the Summary overview badges.
export const overviewDelta = derived([transactions, selectedMonth], ([$transactions, $month]) => {
  const index = availableMonths.indexOf($month);
  const previousMonth = index > 0 ? availableMonths[index - 1] : null;
  const totalsFor = (monthStr) => {
    const items = $transactions.filter((t) => t.date.startsWith(monthStr));
    return {
      income: items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: items.filter(isSpendingTransaction).reduce((s, t) => s + t.amount, 0)
    };
  };
  const current = totalsFor($month);
  const previous = previousMonth ? totalsFor(previousMonth) : null;
  const delta = (curr, prev) => {
    if (!prev) return { pct: 0, dir: 'up' };
    const diff = curr - prev;
    return { pct: Math.round((Math.abs(diff) / prev) * 100), dir: diff >= 0 ? 'up' : 'down' };
  };
  return { incomes: delta(current.income, previous?.income), expenses: delta(current.expense, previous?.expense) };
});

// Every mutator below persists to Postgres first, then applies whatever the
// server recomputed straight onto the stores — never optimistic local math.
// Same principle as Investments (see investments.js): the server is the one
// source of truth for balances/invoices, so a bug in the aggregation only
// has to be fixed in one place.
function applyServerData(data) {
  transactions.set(data.transactions);
  if (data.investmentAccounts) investmentAccounts.set(data.investmentAccounts);
  creditCardsStore.set(data.cards);
  if (data.fixedSeriesSettings) fixedSeriesSettingsStore.set(data.fixedSeriesSettings);
}
async function postJson(url, method, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || 'Failed to save.');
  }
  return res.json();
}

export async function addTransaction(data) {
  const fallbackMonth = get(selectedMonth);
  const payload = { ...data, dueDate: data.dueDate || data.date || `${fallbackMonth}-21`, date: data.date || data.dueDate || `${fallbackMonth}-21` };
  const result = await postJson('/transactions', 'POST', { payload });
  applyServerData(result);
}

// Splits one purchase into N installment records, one per due month, instead
// of a single record carrying installment metadata — each installment shows
// up in its own month's totals, matching "competência por vencimento". The
// actual splitting/rounding math now lives server-side (see
// /transactions/+server.js) so it can never drift from what got saved.
export async function addInstallments(data, installmentStart, installmentTotal, frequency) {
  const baseDue = data.dueDate || data.date || `${get(selectedMonth)}-21`;
  const payload = { ...data, dueDate: baseDue, date: baseDue, local: data.local || '' };
  const result = await postJson('/transactions', 'POST', { mode: 'installments', payload, installmentStart, installmentTotal, installmentFrequency: frequency });
  applyServerData(result);
}
export function installmentSiblings(groupId) {
  return get(transactions).filter((t) => t.installmentGroupId === groupId).sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
}
// Edits shared across the whole installment purchase: name/category/account/
// notes/items apply to every sibling as-is; amount only changes for the one
// installment named by onlyId (the row the user was actually looking at) —
// due dates and which installments are already paid never move here.
export async function updateInstallmentGroup(groupId, data, onlyId) {
  const result = await postJson('/transactions', 'PATCH', { groupId, onlyId, payload: data });
  applyServerData(result);
}
export async function updateTransaction(id, data) {
  const result = await postJson('/transactions', 'PATCH', { id, payload: data });
  applyServerData(result);
}
export async function updateFixedTransaction(id, data, scope) {
  const result = await postJson('/transactions', 'PATCH', { id, payload: data, fixedSeries: true, scope });
  applyServerData(result);
}
export async function bulkSetCategory(ids, category, subcategory) {
  const result = await postJson('/transactions', 'PATCH', { bulkIds: ids, payload: { category, subcategory } });
  applyServerData(result);
}
export async function toggleTransactionStatus(id) {
  const result = await postJson('/transactions', 'PATCH', { id, toggleStatus: true });
  applyServerData(result);
}
export async function deleteTransaction(id) {
  const result = await postJson('/transactions', 'DELETE', { id });
  applyServerData(result);
}
export async function setFixedSeriesEndMonth(local, type, endMonth) {
  const result = await postJson('/fixed-monthly', 'PATCH', { local, type, endMonth });
  applyServerData(result);
}
export async function stopFixedSeries(local, type) {
  const result = await postJson('/fixed-monthly', 'DELETE', { local, type });
  applyServerData(result);
}
// Investments — the server recomputes the accounts (and the transactions
// list, since aporte/retirada are real transfer rows) and we apply it as-is.
// payload: { amount, date, note, ticker?, shares?, product?, rate? } — the
// source account is fixed to Main Account server-side.
export async function addInvestment(accountId, payload) {
  applyServerData(await postJson('/investments', 'POST', { accountId, ...payload }));
}
export async function withdrawInvestment(accountId, payload) {
  applyServerData(await postJson('/investments/withdraw', 'POST', { accountId, ...payload }));
}
export async function saveInvestmentBalances(accountId, values) {
  applyServerData(await postJson('/investments/balances', 'PUT', { accountId, ...values }));
}
export async function payCard(cardId) {
  const month = get(selectedMonth);
  const result = await postJson('/credit-cards', 'POST', { cardId, month });
  applyServerData(result);
}

export function debugSetPending(type, value) {
  const month=get(selectedMonth); const amount=Math.max(0,Number(value)||0); const debugId=`debug-pending-${type}-${month}`;
  transactions.update((items)=>{
    const clean=items
      .filter((item)=>item.id!==debugId)
      .map((item)=>item.type===type&&item.debugOriginalStatus ? {...item,status:item.debugOriginalStatus,debugOriginalStatus:undefined} : item)
      .map((item)=>item.type===type&&item.date.startsWith(month)&&item.status==='pending' ? {...item,status:'paid',debugOriginalStatus:'pending'} : item);
    if(!amount)return clean;
    return [{id:debugId,type,status:'pending',local:type==='expense'?'Debug pending expense':'Debug pending income',category:type==='expense'?'Others':'Services',account:type==='expense'?'Main Account':'Secondary Account',amount,date:`${month}-27`,dueDate:`${month}-27`,debug:true},...clean];
  });
}
// Local-only on purpose — every other debug* helper here just mutates the
// store in memory (reset on reload, never touches Postgres). addTransaction
// now persists for real, so this can't call it: a debug button must never
// write "Debug coffee" into the user's actual financial data.
export function debugAddSample(type) {
  const firstCard = get(creditCardsStore)[0];
  const month = get(selectedMonth);
  const samples={expense:{local:'Debug coffee',category:'Food',account:'Main Account',amount:24.9},income:{local:'Debug payment',category:'Services',account:'Secondary Account',amount:250},transfer:{local:'Main Account → Secondary Account',category:'Transfer',account:'Main Account',destinationAccount:'Secondary Account',amount:100},card:{local:'Debug card purchase',category:'Leisure',account:firstCard?.account||'Main Account',cardId:firstCard?.id,amount:79.9}};
  const transaction = { ...samples[type], type, status: 'paid', id: `debug-${Date.now()}`, date: `${month}-21`, dueDate: `${month}-21`, debug: true };
  transactions.update((items) => [transaction, ...items]);
}
export function debugSetCardInvoice(cardId, value) {
  const month=get(selectedMonth); const amount=Math.max(0,Number(value)||0);
  creditCardsStore.update((cards)=>cards.map((card)=>card.id===cardId?{...card,invoices:{...card.invoices,[month]:amount},paidMonths:card.paidMonths.filter((item)=>item!==month)}:card));
}
export function debugSetAllPaid() {
  const month=get(selectedMonth); transactions.update((items)=>items.map((item)=>item.date.startsWith(month)?{...item,status:'paid'}:item));
}
export function debugResetFinance() {
  if (!snapshot) return;
  transactions.set(structuredClone(snapshot.transactions));
  creditCardsStore.set(structuredClone(snapshot.cards));
  selectedMonth.set(currentMonth());
}
