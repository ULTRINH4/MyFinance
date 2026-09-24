import { json, error } from '@sveltejs/kit';
import { db, ensureInvestmentBalances } from '$lib/server/db/index.js';
import { accounts, investmentBalances } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { loadFinanceData } from '$lib/server/finance-data.js';

// Manual, informational balances for one fixed-income account: accumulated
// value (what the Investments totals show), redeemable value (shown as a
// hint when withdrawing) and total invested. They interact with nothing —
// no transaction is created and no history is kept, only `updated_at`.
export async function PUT({ request }) {
  const body = await request.json();
  const accountId = Number(body.accountId);
  const values = { accumulated: Number(body.accumulated), redeemable: Number(body.redeemable), invested: Number(body.invested) };
  if (!accountId || Object.values(values).some((v) => !Number.isFinite(v) || v < 0)) throw error(400, 'All three values are required and must be 0 or more.');

  await ensureInvestmentBalances();
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account || account.kind !== 'investment') throw error(404, 'Investment account not found.');

  const row = { accumulated: String(values.accumulated), redeemable: String(values.redeemable), invested: String(values.invested), updatedAt: new Date() };
  await db.insert(investmentBalances).values({ accountId, ...row }).onConflictDoUpdate({ target: investmentBalances.accountId, set: row });

  const data = await loadFinanceData();
  return json({ transactions: data.transactions, cards: data.cards, investmentAccounts: data.investmentAccounts });
}
