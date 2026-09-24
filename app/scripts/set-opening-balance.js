import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { accounts, accountBalances } from '../src/lib/server/db/schema.js';

// Sets the real balance of a checking account at the START of a month.
// Usage: node scripts/set-opening-balance.js "Main Account" 2026-01 1234.56
const [, , accountName, month, balance] = process.argv;
if (!accountName || !/^\d{4}-\d{2}$/.test(month || '') || Number.isNaN(Number(balance))) {
  console.error('Usage: node scripts/set-opening-balance.js "<account name>" <YYYY-MM> <balance>');
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const [account] = await db.select().from(accounts).where(eq(accounts.name, accountName));
if (!account) {
  console.error(`Account "${accountName}" not found.`);
  await client.end();
  process.exit(1);
}

const asOf = `${month}-01`;
const value = Number(balance).toFixed(2);
const [existing] = await db.select().from(accountBalances).where(and(eq(accountBalances.accountId, account.id), eq(accountBalances.asOf, asOf)));
if (existing) await db.update(accountBalances).set({ balance: value }).where(eq(accountBalances.id, existing.id));
else await db.insert(accountBalances).values({ accountId: account.id, asOf, balance: value });

console.log(`${accountName}: opening balance for ${month} = ${value}`);
await client.end();
