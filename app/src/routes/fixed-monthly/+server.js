import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { transactions, fixedSeriesSettings } from '$lib/server/db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import { loadFinanceData, localIdByName } from '$lib/server/finance-data.js';

const DB_TYPES = ['expense', 'income', 'transfer'];

function lastDayOfMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return `${monthStr}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

// `type` here must always be the real Postgres enum value — 'card' is a
// client-only display type (a card purchase is really `type='expense'` with
// creditCardId set, see finance-data.js's read-side mapping) and the
// transactions.type column has no 'card' value, so passing it straight
// through crashes every query below. The client sends `dbType` (exposed per
// row in feTransactions) precisely to avoid this.
function assertDbType(type) {
  if (!DB_TYPES.includes(type)) throw error(400, `Invalid type: ${type}`);
}

// Never touches `archived` — PATCH (adjusting a still-active series) must
// not silently un-archive a stopped one, and DELETE below sets it explicitly.
async function upsertEndMonth(localId, type, endMonth) {
  await db
    .insert(fixedSeriesSettings)
    .values({ localId, type, endMonth: `${endMonth}-01` })
    .onConflictDoUpdate({
      target: [fixedSeriesSettings.localId, fixedSeriesSettings.type],
      set: { endMonth: `${endMonth}-01`, updatedAt: new Date() }
    });
}

// Sets (or moves) the month a fixed series stops generating new occurrences
// at. Shortening deletes pending occurrences past the new end right away;
// lengthening just relies on ensureFixedRecurringMaterialized (finance-data.js)
// catching the series up to the new horizon on the next load.
export async function PATCH({ request }) {
  const { local, type, endMonth } = await request.json();
  if (!local || !type || !/^\d{4}-\d{2}$/.test(endMonth || '')) throw error(400, 'Missing or invalid local/type/endMonth.');
  assertDbType(type);

  const localId = await localIdByName(local);
  if (!localId) throw error(404, `Unknown local: ${local}`);

  await upsertEndMonth(localId, type, endMonth);
  await db.delete(transactions).where(and(
    eq(transactions.localId, localId),
    eq(transactions.type, type),
    eq(transactions.recurrence, 'fixed'),
    eq(transactions.confirmed, false),
    gt(transactions.dueDate, lastDayOfMonth(endMonth))
  ));

  const data = await loadFinanceData();
  return json({ transactions: data.transactions, cards: data.cards, fixedSeriesSettings: data.fixedSeriesSettings });
}

// "Stop this series": deletes every future/pending occurrence and freezes
// the series at whatever month its remaining (paid) history reaches, so
// ensureFixedRecurringMaterialized never regenerates it. Paid rows are
// never touched — they keep showing up in Transactions and in this
// series' value history.
export async function DELETE({ request }) {
  const { local, type } = await request.json();
  if (!local || !type) throw error(400, 'Missing local/type.');
  assertDbType(type);

  const localId = await localIdByName(local);
  if (!localId) throw error(404, `Unknown local: ${local}`);

  await db.delete(transactions).where(and(
    eq(transactions.localId, localId),
    eq(transactions.type, type),
    eq(transactions.recurrence, 'fixed'),
    eq(transactions.confirmed, false)
  ));

  const remaining = await db.select().from(transactions).where(and(
    eq(transactions.localId, localId),
    eq(transactions.type, type),
    eq(transactions.recurrence, 'fixed')
  ));
  const lastMonth = remaining.length
    ? remaining.map((r) => (typeof r.dueDate === 'string' ? r.dueDate : r.dueDate.toISOString().slice(0, 10)).slice(0, 7)).sort().at(-1)
    : new Date().toISOString().slice(0, 7);

  await upsertEndMonth(localId, type, lastMonth);
  await db.update(fixedSeriesSettings).set({ archived: true }).where(and(
    eq(fixedSeriesSettings.localId, localId),
    eq(fixedSeriesSettings.type, type)
  ));

  const data = await loadFinanceData();
  return json({ transactions: data.transactions, cards: data.cards, fixedSeriesSettings: data.fixedSeriesSettings });
}
