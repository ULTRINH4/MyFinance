import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { transactions, accounts } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { loadFinanceData, accountIdByName, INVESTMENT_SOURCE_ACCOUNT } from '$lib/server/finance-data.js';

// A new investment is just a transfer transaction into the target account
// (kind 'investment' or 'broker') — see investments-logic.js for why there
// is no separate positions table. `sourceAccountName` is resolved to an id
// here so the frontend never needs to know real DB ids for the checking
// accounts, matching how the rest of the app addresses accounts by name.
// Everything invested comes from (and returns to) Main Account, so the source is
// fixed here instead of trusting the client. A fixed-income aporte is saved
// as PENDING: it shows up in Investments as a notice until the user has
// updated the manual balances and marks it as done. Broker purchases keep
// the old behavior (confirmed right away).

export async function POST({ request }) {
  const body = await request.json();
  const accountId = Number(body.accountId);
  const amount = Number(body.amount);
  const date = body.date;

  if (!accountId || !amount || amount <= 0 || !date) throw error(400, 'Missing or invalid account, amount or date.');

  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account || (account.kind !== 'investment' && account.kind !== 'broker')) throw error(404, 'Investment account not found.');

  const sourceAccountId = await accountIdByName(INVESTMENT_SOURCE_ACCOUNT);
  if (!sourceAccountId) throw error(400, 'Source account not found.');

  const isBroker = account.kind === 'broker';
  if (isBroker && !body.ticker) throw error(400, 'Ticker is required for a broker account.');

  const note = !isBroker && body.product
    ? `${body.product}${body.rate ? ' @ ' + body.rate : ''}${body.note ? ' — ' + body.note : ''}`
    : (body.note || null);

  await db.insert(transactions).values({
    type: 'transfer',
    accountId: sourceAccountId,
    destinationAccountId: accountId,
    amount: String(amount),
    dueDate: date,
    entryDate: date,
    effectiveDate: date,
    confirmed: isBroker,
    transferKind: isBroker ? 'stock_purchase' : 'transfer',
    stockTicker: isBroker ? String(body.ticker).toUpperCase() : null,
    stockShares: isBroker ? String(Number(body.shares) || 0) : null,
    note
  });

  const data = await loadFinanceData();
  return json({ transactions: data.transactions, cards: data.cards, investmentAccounts: data.investmentAccounts });
}
