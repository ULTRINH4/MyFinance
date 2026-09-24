import { eq, and, sql } from 'drizzle-orm';
import { db, ensureInvestmentBalances } from './db/index.js';
import { transactions, locals, categories, subcategories, accounts, creditCards, accountBalances, fixedSeriesSettings, investmentBalances } from './db/schema.js';
import { computeInvestmentAccounts } from '../investments-logic.js';

// Everything invested comes from (and returns to) this account.
export const INVESTMENT_SOURCE_ACCOUNT = 'Main Account';

function toDateStr(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : value.toISOString().slice(0, 10);
}

function monthRange(startMonth, endMonth) {
  const months = [];
  let [y, m] = startMonth.split('-').map(Number);
  const [endY, endM] = endMonth.split('-').map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function addMonthClamped(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = (m - 1) + delta;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const lastDay = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

// schema.md originally planned a `recurring_templates` table materialized by
// a node-cron process; that table was never built, so `recurrence='fixed'`
// rows only ever existed for months a human had already created by hand —
// a fixed monthly expense (e.g. a gym membership) simply never showed up as
// pending for a month nobody had gotten around to entering yet. Given how
// small and low-traffic this app is (single user), a scheduled worker is
// overkill; instead, every load makes sure each fixed series reaches
// FIXED_RECURRING_HORIZON, cloning its latest occurrence (siblings are
// matched by localId, same grouping the fixed-series PATCH endpoint uses).
// Every fixed series runs out to Dec/2028 —
// existing ones were backfilled by hand once; this constant is what keeps
// any newly created fixed expense caught up to the same horizon automatically.
export const FIXED_RECURRING_HORIZON = '2028-12';

// Card-linked fixed series (e.g. a subscription billed on a credit card)
// only ever really know their next invoice — anything past that is a
// projection nobody has actually been charged for yet, and counting it as
// real committed spend inflates the card's outstanding balance for years
// (see Credit Cards' outstandingBalance). Non-card fixed series (direct
// account debits) keep running out to FIXED_RECURRING_HORIZON as before.
function nextMonthStr() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 2; // +1 for 1-based, +1 for "next"
  if (month > 12) { month -= 12; year += 1; }
  return `${year}-${String(month).padStart(2, '0')}`;
}

async function ensureFixedRecurringMaterialized() {
  const fixedRows = await db.select().from(transactions).where(eq(transactions.recurrence, 'fixed'));
  if (!fixedRows.length) return;

  const settingsRows = await db.select().from(fixedSeriesSettings);
  const endMonthByKey = new Map(settingsRows.map((s) => [`${s.localId}:${s.type}`, toDateStr(s.endMonth).slice(0, 7)]));

  const groups = new Map();
  for (const row of fixedRows) {
    if (!row.localId) continue;
    const key = `${row.localId}:${row.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const cardCap = nextMonthStr();
  for (const [key, rows] of groups) {
    const isCardSeries = rows.some((r) => r.creditCardId);
    const customEndMonth = endMonthByKey.get(key);
    const targetMonth = isCardSeries
      ? (customEndMonth && customEndMonth < cardCap ? customEndMonth : cardCap)
      : (customEndMonth ?? FIXED_RECURRING_HORIZON);
    rows.sort((a, b) => toDateStr(a.dueDate).localeCompare(toDateStr(b.dueDate)));
    let last = rows[rows.length - 1];
    let guard = 0;
    while (toDateStr(last.dueDate).slice(0, 7) < targetMonth && guard < 120) {
      const newDueDate = addMonthClamped(toDateStr(last.dueDate), 1);
      const [inserted] = await db.insert(transactions).values({
        type: last.type,
        localId: last.localId,
        categoryId: last.categoryId,
        subcategoryId: last.subcategoryId,
        accountId: last.accountId,
        destinationAccountId: last.destinationAccountId,
        creditCardId: last.creditCardId,
        amount: last.amount,
        dueDate: newDueDate,
        note: last.note,
        confirmed: false,
        recurrence: 'fixed',
        isRecurringSubscription: last.isRecurringSubscription,
        ignoreInTotals: last.ignoreInTotals
      }).returning();
      last = inserted;
      guard++;
    }
  }
}

export async function loadFinanceData() {
  await ensureFixedRecurringMaterialized();
  await ensureInvestmentBalances();

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      dueDate: transactions.dueDate,
      entryDate: transactions.entryDate,
      confirmed: transactions.confirmed,
      isRecurringSubscription: transactions.isRecurringSubscription,
      recurrence: transactions.recurrence,
      installmentNumber: transactions.installmentNumber,
      installmentTotal: transactions.installmentTotal,
      installmentGroupId: transactions.installmentGroupId,
      creditCardId: transactions.creditCardId,
      accountId: transactions.accountId,
      destinationAccountId: transactions.destinationAccountId,
      transferKind: transactions.transferKind,
      stockTicker: transactions.stockTicker,
      stockShares: transactions.stockShares,
      note: transactions.note,
      items: transactions.items,
      source: transactions.source,
      localName: locals.name,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      accountName: accounts.name
    })
    .from(transactions)
    .leftJoin(locals, eq(locals.id, transactions.localId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, transactions.subcategoryId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId));

  const destinationAccounts = await db.select().from(accounts);
  const accountNameById = new Map(destinationAccounts.map((a) => [a.id, a.name]));

  const feTransactions = rows.map((t) => {
    const dueDate = toDateStr(t.dueDate);
    // `date` drives which month a transaction belongs to everywhere
    // (visibleTransactions, balances, invoices) — it must stay the due
    // date (a card purchase debits the account on the invoice due date,
    // not the purchase date; that's the whole reconciliation model this
    // app is built on). `entryDate` is a display-only field: the real
    // purchase date, for Transactions to show instead of the due date
    // (which is always the card's fixed due day, e.g. always the 10th).
    const date = dueDate;
    const entryDate = t.entryDate ? toDateStr(t.entryDate) : dueDate;
    const category = t.categoryName ? `${t.categoryName}${t.subcategoryName ? ' · ' + t.subcategoryName : ''}` : '';
    return {
      id: t.id,
      type: t.type === 'expense' && t.creditCardId ? 'card' : t.type,
      // Real DB enum value ('card' is a client-only display type — Postgres
      // only knows expense/income/transfer). Anything matching siblings by
      // type server-side (fixed-series settings, PATCH scope) must use this,
      // never the display `type` above.
      dbType: t.type,
      status: t.confirmed ? 'paid' : 'pending',
      local: t.localName || '',
      category,
      account: t.accountName || '',
      destinationAccount: t.destinationAccountId ? accountNameById.get(t.destinationAccountId) : undefined,
      cardId: t.creditCardId ?? undefined,
      // The lump-sum invoice settlement — real signal is the technical
      // category (see migrate-taxonomy.js), not a dedicated column.
      // Matters for isSpendingTransaction: a settlement is cash leaving the
      // account, not new spending (the spend already counted when the card
      // purchases themselves were made).
      cardPayment: t.categoryName === 'Credit cards' && t.subcategoryName === 'Invoice payment' ? true : undefined,
      source: t.source,
      amount: Number(t.amount),
      date,
      dueDate,
      entryDate,
      recurring: t.isRecurringSubscription,
      recurrence: t.recurrence,
      installmentNumber: t.installmentNumber ?? undefined,
      installmentTotal: t.installmentTotal ?? undefined,
      installmentGroupId: t.installmentGroupId ?? undefined,
      transferKind: t.transferKind ?? undefined,
      stockTicker: t.stockTicker ?? undefined,
      stockShares: t.stockShares ?? undefined,
      note: t.note || undefined,
      items: Array.isArray(t.items) && t.items.length ? t.items : undefined
    };
  });

  const cardRows = await db
    .select({ id: creditCards.id, name: creditCards.name, badge: creditCards.badge, color: creditCards.color, brand: creditCards.brand, closureDay: creditCards.closureDay, dueDay: creditCards.dueDay, limitAmount: creditCards.limitAmount, accountId: creditCards.accountId })
    .from(creditCards)
    .orderBy(creditCards.sortOrder, creditCards.id);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  const dueDates = feTransactions.map((t) => t.dueDate).filter(Boolean).sort();
  const earliestMonth = dueDates.length ? dueDates[0].slice(0, 7) : currentMonthStr;
  const latestMonth = dueDates.length ? dueDates[dueDates.length - 1].slice(0, 7) : currentMonthStr;
  const availableMonths = monthRange(earliestMonth, latestMonth);

  const cards = cardRows.map((card) => {
    const cardTx = feTransactions.filter((t) => t.cardId === card.id);
    // A prior attempt at "paid the instant you register, not just once the
    // due date passes" matched any settlement row by local name+month —
    // that reached back into the historically-imported data (source
    // 'import'), where plenty of past months already had a matching row for
    // unrelated reasons, and flipped all of them to "Paid" at once. Scoping
    // to source 'app' makes this only ever match a row this endpoint itself
    // just inserted — the historical import can never produce one, so past
    // months are structurally untouched regardless of what they contain.
    // Also requires status 'paid' — unconfirming the settlement row (the
    // Transactions list toggle) is how you undo a registered payment short
    // of deleting it outright, and that has to bring the card back to
    // "unpaid" too, not just leave a pending row still counted as settled.
    const registeredPayments = feTransactions.filter((t) => t.cardPayment && t.source === 'app' && t.status === 'paid' && t.local === card.name);
    const invoices = {};
    const nextInvoices = {};
    const paidMonths = [];
    availableMonths.forEach((month, i) => {
      const monthTx = cardTx.filter((t) => t.dueDate.startsWith(month));
      invoices[month] = monthTx.reduce((s, t) => s + t.amount, 0);
      const nextMonth = availableMonths[i + 1];
      nextInvoices[month] = nextMonth ? cardTx.filter((t) => t.dueDate.startsWith(nextMonth)).reduce((s, t) => s + t.amount, 0) : 0;
      const monthDueDate = `${month}-${String(card.dueDay).padStart(2, '0')}`;
      // A month counts as paid once its due date has passed AND every one
      // of its purchases actually cleared (status 'paid') — a real bank
      // invoice due date passing doesn't settle debt that's still
      // unconfirmed, that debt must keep counting as open — OR once a
      // payment registered through the app itself exists for it, regardless
      // of date (see registeredPayments above for why this is safe now).
      const allSettled = monthTx.length === 0 || monthTx.every((t) => t.status === 'paid');
      const paymentRegistered = registeredPayments.some((t) => t.dueDate.startsWith(month));
      if ((monthDueDate < todayStr && allSettled) || paymentRegistered) paidMonths.push(month);
    });
    // Real usable credit today: limit minus every purchase/installment on
    // this card that hasn't actually been paid off yet, regardless of which
    // month it falls due (a parcelamento's future installments are already
    // locked against the limit the moment the purchase is made).
    const outstandingBalance = cardTx.filter((t) => t.status !== 'paid').reduce((s, t) => s + t.amount, 0);
    return {
      id: card.id,
      name: card.name,
      badge: card.badge,
      color: card.color,
      brand: card.brand,
      account: accountNameById.get(card.accountId),
      limit: card.limitAmount ? Number(card.limitAmount) : 0,
      closureDay: card.closureDay,
      dueDay: card.dueDay,
      invoices,
      nextInvoices,
      paidMonths,
      outstandingBalance
    };
  });

  // Real per-month opening balances straight from the bank statements
  // (Main Account + Secondary Account — the only accounts that ever hold a real balance;
  // Digital Wallet/Cash Wallet stay at R$0, Fixed Income/Brokerage are
  // ignore_in_totals). Ground truth, not derived by summing categorized
  // transactions — that approach repeatedly failed to reconcile.
  const balanceRows = await db
    .select({ asOf: accountBalances.asOf, balance: accountBalances.balance, ignoreInTotals: accounts.ignoreInTotals, accountName: accounts.name })
    .from(accountBalances)
    .innerJoin(accounts, eq(accounts.id, accountBalances.accountId));

  const monthOpenings = {};
  const accountOpenings = {};
  for (const row of balanceRows) {
    if (row.ignoreInTotals) continue;
    const month = toDateStr(row.asOf).slice(0, 7);
    monthOpenings[month] = (monthOpenings[month] || 0) + Number(row.balance);
    (accountOpenings[row.accountName] ??= {})[month] = Number(row.balance);
  }

  // Investments: no separate positions table (see investments-logic.js) —
  // they're just transfer transactions into/out of accounts of kind
  // 'investment'/'broker'. Ignored by monthOpenings/accountOpenings above
  // (they're ignore_in_totals) but they're real rows in `transactions`.
  const investmentAccountRows = destinationAccounts.filter((a) => a.kind === 'investment' || a.kind === 'broker');
  const manualBalanceRows = await db.select().from(investmentBalances);
  const manualBalances = new Map(manualBalanceRows.map((b) => [b.accountId, { accumulated: Number(b.accumulated), redeemable: Number(b.redeemable), invested: Number(b.invested), updatedAt: b.updatedAt.toISOString() }]));
  const investmentAccounts = computeInvestmentAccounts(feTransactions, investmentAccountRows, availableMonths, manualBalances);

  // Exposed by local name, never localId — the client already never learns
  // real DB ids for anything (same reasoning as local/category/account
  // names elsewhere in this file).
  const fixedSeriesRows = await db
    .select({ local: locals.name, type: fixedSeriesSettings.type, endMonth: fixedSeriesSettings.endMonth, archived: fixedSeriesSettings.archived })
    .from(fixedSeriesSettings)
    .innerJoin(locals, eq(locals.id, fixedSeriesSettings.localId));

  return {
    availableMonths,
    monthOpenings,
    accountOpenings,
    ignoredAccountNames: destinationAccounts.filter((a) => a.ignoreInTotals).map((a) => a.name),
    transactions: feTransactions,
    cards,
    investmentAccounts,
    fixedSeriesSettings: fixedSeriesRows.map((r) => ({ local: r.local, type: r.type, endMonth: toDateStr(r.endMonth).slice(0, 7), archived: r.archived }))
  };
}

export async function localIdByName(name) {
  const [row] = await db.select({ id: locals.id }).from(locals).where(eq(locals.name, name));
  return row?.id;
}

export async function accountIdByName(name) {
  const [row] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.name, name));
  return row?.id;
}

export async function categoryIdByName(name, type) {
  const [row] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.name, name), eq(categories.type, type)));
  return row?.id;
}

export async function subcategoryIdByName(categoryId, name) {
  if (!categoryId || !name) return null;
  const [row] = await db.select({ id: subcategories.id }).from(subcategories).where(and(eq(subcategories.categoryId, categoryId), eq(subcategories.name, name)));
  return row?.id ?? null;
}

// Locals track "who/where" (schema's own local-suggestion mechanism) — find
// or create by name, then bump usage stats so the freshest amount/category
// stay attached for future autofill.
export async function localIdFindOrCreate(name, { categoryId, subcategoryId, accountId, amount } = {}) {
  if (!name) return null;
  const [existing] = await db.select({ id: locals.id }).from(locals).where(eq(locals.name, name));
  if (existing) {
    await db.update(locals).set({
      usageCount: sql`${locals.usageCount} + 1`,
      lastCategoryId: categoryId ?? null,
      lastSubcategoryId: subcategoryId ?? null,
      lastAccountId: accountId ?? null,
      lastAmount: amount != null ? String(amount) : null,
      lastUsedAt: new Date()
    }).where(eq(locals.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(locals).values({
    name,
    usageCount: 1,
    lastCategoryId: categoryId ?? null,
    lastSubcategoryId: subcategoryId ?? null,
    lastAccountId: accountId ?? null,
    lastAmount: amount != null ? String(amount) : null,
    lastUsedAt: new Date()
  }).returning({ id: locals.id });
  return created.id;
}
