import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { transactions, accounts } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { loadFinanceData, accountIdByName, INVESTMENT_SOURCE_ACCOUNT } from '$lib/server/finance-data.js';

// A withdrawal is a transfer from the investment account back to Main Account,
// saved as PENDING (same notice flow as an aporte — see ../+server.js). It
// never touches the manual balances; the user updates those and then marks
// the movement as done. Fixed income only for now (brokerage sells need
// ticker/shares and have no flow yet).
export async function POST({ request }) {
  const body = await request.json();
  const accountId = Number(body.accountId);
  const amount = Number(body.amount);
  const date = body.date;
  if (!accountId || !Number.isFinite(amount) || amount <= 0 || !date) throw error(400, 'Missing or invalid account, amount or date.');

  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account || account.kind !== 'investment') throw error(404, 'Investment account not found.');

  const destinationAccountId = await accountIdByName(INVESTMENT_SOURCE_ACCOUNT);
  if (!destinationAccountId) throw error(400, 'Main Account account not found.');

  await db.insert(transactions).values({
    type: 'transfer',
    accountId,
    destinationAccountId,
    amount: String(amount),
    dueDate: date,
    entryDate: date,
    effectiveDate: date,
    confirmed: false,
    transferKind: 'redemption',
    note: body.note || null
  });

  const data = await loadFinanceData();
  return json({ transactions: data.transactions, cards: data.cards, investmentAccounts: data.investmentAccounts });
}
