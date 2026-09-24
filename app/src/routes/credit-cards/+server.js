import { json, error } from '@sveltejs/kit';
import { and, eq, gte, lt } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { transactions } from '$lib/server/db/schema.js';
import { loadFinanceData, categoryIdByName, subcategoryIdByName, accountIdByName, localIdFindOrCreate } from '$lib/server/finance-data.js';

// "Register payment" — inserts the real full-invoice settlement expense
// (same category/subcategory convention as the historically-imported
// payments: Credit cards · Invoice payment), on the card's own linked
// account. paidMonths itself isn't a stored flag (see finance-data.js —
// it's a date heuristic), so nothing else needs updating here; the new
// transaction is what actually keeps the account balance and the
// isSpendingTransaction/cardPayment split correct going forward.
export async function POST({ request }) {
  const { cardId, month } = await request.json();
  if (!cardId || !month) throw error(400, 'Missing card or month.');

  const data = await loadFinanceData();
  const card = data.cards.find((c) => c.id === Number(cardId));
  if (!card) throw error(404, 'Card not found.');

  const invoice = card.invoices[month] || 0;
  // Used to silently return the unchanged data here — from the UI that
  // looked identical to a successful save that did nothing (click,
  // no error, invoice still open). Both cases below mean the client's
  // cached invoice/paidMonths disagree with what the server just
  // recomputed fresh from Postgres, so surface it instead of no-op'ing.
  if (card.paidMonths.includes(month)) throw error(409, `${card.name}'s ${month} invoice is already marked as paid — refresh the page to sync.`);
  if (invoice <= 0) throw error(409, `${card.name}'s ${month} invoice is R$ 0.00 on the server — refresh the page to sync.`);

  const categoryId = await categoryIdByName('Credit cards', 'expense');
  const subcategoryId = await subcategoryIdByName(categoryId, 'Invoice payment');
  const accountId = await accountIdByName(card.account);
  if (!accountId) throw error(400, `Unknown account: ${card.account}`);
  const localId = await localIdFindOrCreate(card.name, { categoryId, subcategoryId, accountId, amount: invoice });

  // paidMonths above already covers this once a payment lands (see
  // finance-data.js), but that's computed from a snapshot taken at the top
  // of this request — two clicks close enough together (exactly what
  // produced 24 duplicate settlements in testing on 04/09/2026) both pass
  // that check before either insert completes. Re-check Postgres directly,
  // right before the insert, to close that race.
  // due_date is a real `date` column — LIKE against it fails in Postgres
  // (it needs a text operand), so match the month as a date range instead.
  const [y, m] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const [existingPayment] = await db.select({ id: transactions.id }).from(transactions)
    .where(and(eq(transactions.localId, localId), eq(transactions.categoryId, categoryId), eq(transactions.subcategoryId, subcategoryId), gte(transactions.dueDate, monthStart), lt(transactions.dueDate, monthEnd)));
  if (existingPayment) throw error(409, `${card.name}'s ${month} invoice payment is already registered.`);

  // dueDate anchors the settlement to the right invoice month/day (the
  // card's real due day, not a fixed "21st" that never matched any card) —
  // paidMonths and the duplicate check above both key off it. entryDate is
  // the real-world date the money actually left the account (today, when
  // this endpoint runs), same real-date-vs-bucketing-date split used for
  // regular transactions everywhere else.
  await db.insert(transactions).values({
    type: 'expense',
    localId,
    categoryId,
    subcategoryId,
    accountId,
    amount: String(invoice),
    dueDate: `${month}-${String(card.dueDay).padStart(2, '0')}`,
    entryDate: new Date().toISOString().slice(0, 10),
    confirmed: true,
    note: `Full invoice settlement — ${card.name}`
  });

  const fresh = await loadFinanceData();
  return json({ transactions: fresh.transactions, cards: fresh.cards });
}
