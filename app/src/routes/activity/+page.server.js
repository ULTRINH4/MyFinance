import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { transactions, locals as localsTable, accounts, creditCards } from '$lib/server/db/schema.js';
import { desc, eq } from 'drizzle-orm';

// Dev-only audit view — added 04/09/2026 after a debugging session produced
// duplicate rows with no way to tell which ones were real vs. test/agent
// cleanup. Reads straight off `transactions.source` + timestamps, nothing
// else (see schema.js) — never wired into prod, and 404s here too in case
// someone hits the URL directly on a prod build.
export async function load() {
  if (!import.meta.env.DEV) throw error(404, 'Not found');

  const rows = await db
    .select({
      id: transactions.id,
      local: localsTable.name,
      account: accounts.name,
      cardName: creditCards.name,
      amount: transactions.amount,
      type: transactions.type,
      source: transactions.source,
      note: transactions.note,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt
    })
    .from(transactions)
    .leftJoin(localsTable, eq(localsTable.id, transactions.localId))
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(creditCards, eq(creditCards.id, transactions.creditCardId))
    .orderBy(desc(transactions.updatedAt))
    .limit(150);

  return {
    rows: rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      edited: r.updatedAt.getTime() !== r.createdAt.getTime()
    }))
  };
}
