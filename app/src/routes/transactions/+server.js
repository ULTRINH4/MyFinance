import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { transactions, creditCards } from '$lib/server/db/schema.js';
import { eq, and, gte } from 'drizzle-orm';
import { loadFinanceData, accountIdByName, categoryIdByName, subcategoryIdByName, localIdFindOrCreate } from '$lib/server/finance-data.js';
import { splitInstallments, splitTotal, rescheduleInstallments } from '$lib/installments-logic.js';

// Accepts either the form's picker value ('repeat') or an already-real DB
// enum value (when the client reconstructs a payload from a loaded
// transaction, e.g. toggling status) — never silently drops it to 'none'.
const DB_RECURRENCE_VALUES = ['none', 'installment', 'fixed'];
function normalizeRecurrence(value) {
  if (value === 'repeat') return 'installment';
  return DB_RECURRENCE_VALUES.includes(value) ? value : 'none';
}

// Turns the form's flat payload (local/category/subcategory/account names,
// never ids — the frontend still doesn't know real DB ids) into a real
// insertable/updatable row. A "card" purchase is really `type='expense'`
// with credit_card_id set (see finance-data.js's read-side mapping) — the
// due date for a card purchase is derived from the chosen invoice month +
// the card's own due day, never a value typed directly (the form hides the
// due-date field for card type; using "whatever month is selected in the
// UI" here was a real bug in the old client-only version).
async function resolveRow(payload) {
  const dbType = payload.type === 'card' ? 'expense' : payload.type;
  const isCard = payload.type === 'card';

  let dueDate = payload.dueDate || payload.date || null;
  if (isCard) {
    if (!payload.cardId) throw error(400, 'Missing credit card.');
    const [card] = await db.select().from(creditCards).where(eq(creditCards.id, Number(payload.cardId)));
    if (!card) throw error(400, 'Unknown credit card.');
    if (payload.invoiceMonth) dueDate = `${payload.invoiceMonth}-${String(card.dueDay).padStart(2, '0')}`;
  }
  if (!dueDate) throw error(400, 'Missing due date.');

  const accountId = payload.account ? await accountIdByName(payload.account) : null;
  if (payload.account && !accountId) throw error(400, `Unknown account: ${payload.account}`);
  const destinationAccountId = dbType === 'transfer' && payload.destinationAccount ? await accountIdByName(payload.destinationAccount) : null;
  if (dbType === 'transfer' && payload.destinationAccount && !destinationAccountId) throw error(400, `Unknown destination account: ${payload.destinationAccount}`);

  let categoryId = null;
  let subcategoryId = null;
  if (dbType !== 'transfer' && payload.category) {
    categoryId = await categoryIdByName(payload.category, dbType);
    if (!categoryId) throw error(400, `Unknown category: ${payload.category}`);
    subcategoryId = payload.subcategory ? await subcategoryIdByName(categoryId, payload.subcategory) : null;
  }

  const localId = await localIdFindOrCreate(payload.local, { categoryId, subcategoryId, accountId, amount: payload.amount });

  const items = Array.isArray(payload.items) && payload.items.length
    ? payload.items.map((i) => ({ description: i.description, amount: i.amount != null && i.amount !== '' ? Number(i.amount) : null }))
    : null;

  const recurrence = normalizeRecurrence(payload.recurrence);

  return {
    type: dbType,
    localId,
    categoryId,
    subcategoryId,
    accountId,
    destinationAccountId,
    creditCardId: isCard ? Number(payload.cardId) : null,
    amount: String(Number(payload.amount)),
    dueDate,
    entryDate: payload.registrationDate || null,
    effectiveDate: payload.settlementDate || null,
    note: payload.note || null,
    items,
    confirmed: payload.status !== 'pending',
    recurrence,
    isRecurringSubscription: recurrence === 'fixed',
    ignoreInTotals: Boolean(payload.ignoreCardLimit),
    transferKind: dbType === 'transfer' ? 'transfer' : null
  };
}

export async function POST({ request }) {
  const body = await request.json();

  if (body.mode === 'installments') {
    const { payload, installmentStart, installmentTotal, installmentFrequency } = body;
    const start = Math.max(1, Number(installmentStart) || 1);
    const total = Math.max(start, Number(installmentTotal) || start);
    // Card purchases have no due-date field: each installment's due date is
    // rebuilt by resolveRow from its invoice month, so the split has to
    // advance the invoice month (day 01 avoids month-end clamping) instead
    // of the date — otherwise every installment lands on the same invoice.
    const isCard = payload.type === 'card' && payload.invoiceMonth;
    const baseDue = isCard ? `${payload.invoiceMonth}-01` : (payload.dueDate || payload.date);
    if (!baseDue) throw error(400, 'Missing due date.');
    const groupId = crypto.randomUUID();
    const installments = splitInstallments(Number(payload.amount), baseDue, start, total, installmentFrequency);
    for (const installment of installments) {
      const row = await resolveRow({ ...payload, ...(isCard ? { invoiceMonth: installment.dueDate.slice(0, 7) } : {}), amount: installment.amount, dueDate: installment.dueDate, date: installment.dueDate, status: installment.installmentNumber === start ? payload.status : 'pending' });
      await db.insert(transactions).values({ ...row, installmentNumber: installment.installmentNumber, installmentTotal: total, installmentGroupId: groupId });
    }
  } else {
    const row = await resolveRow(body.payload);
    await db.insert(transactions).values(row);
  }

  const data = await loadFinanceData();
  return json({ transactions: data.transactions, cards: data.cards, investmentAccounts: data.investmentAccounts });
}

export async function PATCH({ request }) {
  const body = await request.json();

  if (body.toggleStatus) {
    if (!body.id) throw error(400, 'Missing transaction id.');
    const [existing] = await db.select().from(transactions).where(eq(transactions.id, Number(body.id)));
    if (!existing) throw error(404, 'Transaction not found.');
    await db.update(transactions).set({ confirmed: !existing.confirmed }).where(eq(transactions.id, Number(body.id)));
  } else if (body.groupId) {
    // Shared fields (name/category/account/note/items) describe the
    // purchase and apply to every installment alike. Amount is the one
    // field that's genuinely per-installment — body.onlyId names which row
    // gets the new payload.amount; every other sibling keeps its own
    // amount untouched. Paid/pending status never moves here; due dates only
    // move when the edited installment's date changed (see below).
    const siblings = await db.select().from(transactions).where(eq(transactions.installmentGroupId, body.groupId)).orderBy(transactions.installmentNumber);
    if (!siblings.length) throw error(404, 'Installment group not found.');
    const accountId = body.payload.account ? await accountIdByName(body.payload.account) : siblings[0].accountId;
    // A card purchase's cardId can change here too (e.g. moving an
    // installment purchase from one card to another) — without this the
    // edit form's card picker silently no-ops, since accountId above only
    // follows the card's *linked account*, never credit_card_id itself.
    const creditCardId = body.payload.cardId ? Number(body.payload.cardId) : siblings[0].creditCardId;
    const categoryId = body.payload.category ? await categoryIdByName(body.payload.category, siblings[0].type) : siblings[0].categoryId;
    // Category and subcategory travel together — whenever a category comes
    // in, its subcategory must be resolved fresh against THAT category
    // (never fall back to the old subcategoryId, or switching to a
    // category with no subcategories at all leaves a stale/mismatched one
    // dangling — caught for real via a live E2E check on 24/08/2026).
    const subcategoryId = body.payload.category
      ? (body.payload.subcategory ? await subcategoryIdByName(categoryId, body.payload.subcategory) : null)
      : siblings[0].subcategoryId;
    const localId = body.payload.local ? await localIdFindOrCreate(body.payload.local, { categoryId, subcategoryId, accountId, amount: body.payload.amount }) : siblings[0].localId;
    const items = Array.isArray(body.payload.items) && body.payload.items.length
      ? body.payload.items.map((i) => ({ description: i.description, amount: i.amount != null && i.amount !== '' ? Number(i.amount) : null }))
      : null;
    const onlyId = body.onlyId ? Number(body.onlyId) : null;
    // Editing the purchase's full total re-splits it evenly across every
    // sibling (same rounding rule as the initial split) and takes priority
    // over the single-installment `amount` field — the two edit the same
    // thing at different granularities, never both at once. The form always
    // submits `groupTotal` (pre-filled with the current sum) even when the
    // user never touched it, so only re-split when it actually moved —
    // otherwise a plain category/note edit would silently flatten amounts
    // that had been hand-adjusted per installment before.
    const currentTotal = siblings.reduce((sum, sib) => sum + Number(sib.amount), 0);
    const requestedTotal = body.payload.groupTotal != null && body.payload.groupTotal !== '' ? Number(body.payload.groupTotal) : null;
    const newTotal = requestedTotal != null && Math.abs(requestedTotal - currentTotal) >= 0.005 ? requestedTotal : null;
    const splitAmounts = newTotal != null ? splitTotal(newTotal, siblings.length) : null;
    for (let index = 0; index < siblings.length; index++) {
      const sib = siblings[index];
      const amount = splitAmounts ? String(splitAmounts[index]) : (onlyId && sib.id === onlyId ? String(Number(body.payload.amount)) : sib.amount);
      await db.update(transactions).set({ localId, categoryId, subcategoryId, accountId, creditCardId, note: body.payload.note || null, items, amount }).where(eq(transactions.id, sib.id));
    }
    // Changing one installment's due date shifts the whole purchase from that
    // anchor (card purchases send no dueDate — theirs follows the invoice).
    if (onlyId && body.payload.dueDate) {
      const shifts = rescheduleInstallments(
        siblings.map((sib) => ({ id: sib.id, installmentNumber: sib.installmentNumber, dueDate: String(sib.dueDate).slice(0, 10), confirmed: sib.confirmed })),
        onlyId,
        body.payload.dueDate
      );
      for (const shift of shifts) await db.update(transactions).set({ dueDate: shift.dueDate }).where(eq(transactions.id, shift.id));
    }
  } else if (body.fixedSeries && body.scope === 'onwards') {
    // "Fixed monthly" transactions aren't grouped like installments (no
    // installmentGroupId) — the closest thing to "the same series" is
    // matching localId + type + recurrence='fixed'. Same shared-fields
    // pattern as the installment group PATCH above, but scoped to this
    // row's due date onwards instead of a bounded group, and due dates
    // themselves never move (each future occurrence keeps its own month).
    if (!body.id) throw error(400, 'Missing transaction id.');
    const [existing] = await db.select().from(transactions).where(eq(transactions.id, Number(body.id)));
    if (!existing) throw error(404, 'Transaction not found.');
    const siblings = await db.select().from(transactions).where(and(
      eq(transactions.localId, existing.localId),
      eq(transactions.type, existing.type),
      eq(transactions.recurrence, 'fixed'),
      gte(transactions.dueDate, existing.dueDate)
    ));
    const accountId = body.payload.account ? await accountIdByName(body.payload.account) : existing.accountId;
    const categoryId = body.payload.category ? await categoryIdByName(body.payload.category, existing.type) : existing.categoryId;
    const subcategoryId = body.payload.category
      ? (body.payload.subcategory ? await subcategoryIdByName(categoryId, body.payload.subcategory) : null)
      : existing.subcategoryId;
    const localId = body.payload.local ? await localIdFindOrCreate(body.payload.local, { categoryId, subcategoryId, accountId, amount: body.payload.amount }) : existing.localId;
    const amount = String(Number(body.payload.amount));
    const note = body.payload.note || null;
    for (const sib of siblings) {
      await db.update(transactions).set({ localId, categoryId, subcategoryId, accountId, amount, note }).where(eq(transactions.id, sib.id));
    }
  } else if (Array.isArray(body.bulkIds) && body.bulkIds.length) {
    // Bulk category re-assignment, e.g. Reports/Categories taxonomy cleanup
    // across many rows at once — only touches category/subcategory, nothing
    // else about each row. Each id resolves the category against its OWN
    // real type (never a type sent by the client — a mixed-type selection
    // of transfers has no category and is filtered out client-side, but a
    // card purchase's real type is 'expense', same taxonomy as a plain one).
    const { category, subcategory } = body.payload || {};
    if (!category) throw error(400, 'Missing category.');
    for (const id of body.bulkIds) {
      const [existing] = await db.select().from(transactions).where(eq(transactions.id, Number(id)));
      if (!existing || existing.type === 'transfer') continue;
      const categoryId = await categoryIdByName(category, existing.type);
      if (!categoryId) throw error(400, `Unknown category: ${category}`);
      const subcategoryId = subcategory ? await subcategoryIdByName(categoryId, subcategory) : null;
      await db.update(transactions).set({ categoryId, subcategoryId }).where(eq(transactions.id, existing.id));
    }
  } else {
    if (!body.id) throw error(400, 'Missing transaction id.');
    const [existing] = await db.select().from(transactions).where(eq(transactions.id, Number(body.id)));
    if (!existing) throw error(404, 'Transaction not found.');
    const row = await resolveRow(body.payload);
    await db.update(transactions).set(row).where(eq(transactions.id, Number(body.id)));
  }

  const data = await loadFinanceData();
  return json({ transactions: data.transactions, cards: data.cards, investmentAccounts: data.investmentAccounts });
}

export async function DELETE({ request }) {
  const { id } = await request.json();
  if (!id) throw error(400, 'Missing transaction id.');
  await db.delete(transactions).where(eq(transactions.id, Number(id)));

  const data = await loadFinanceData();
  return json({ transactions: data.transactions, cards: data.cards, investmentAccounts: data.investmentAccounts });
}
