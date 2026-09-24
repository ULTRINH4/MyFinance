import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { categories, subcategories, accounts, creditCards, accountBalances } from '../src/lib/server/db/schema.js';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const expenseCategories = [
  ['Food', true], ['Grocery', true], ['Leisure', false], ['Car', false],
  ['Clothing', false], ['Services', true], ['Taxes', true], ['Bills', true],
  ['Subscriptions', true], ['Payments', true], ['Others', false],
  ['Credit cards', false]
];
const incomeCategories = [
  ['Salary', true], ['Sales', false], ['Investments', true],
  ['Others', false], ['Payments', true], ['Services', true]
];

const expenseSubcategories = {
  Leisure: ['Games', 'Electronics', 'Sports', 'Travel'],
  Car: ['Fuel', 'Wash', 'Others'],
  Clothing: ['Shirts', 'Others'],
  Others: ['Adjustments'],
  'Credit cards': ['Invoice advance', 'Chargebacks', 'Others']
};
const incomeSubcategories = {
  Sales: ['Others'],
  Others: ['Adjustments']
};

async function ensureCategory(name, type, isGeneric) {
  const [existing] = await db.select().from(categories).where(and(eq(categories.name, name), eq(categories.type, type)));
  if (existing) return existing;
  const [created] = await db.insert(categories).values({ name, type, isGeneric }).returning();
  return created;
}

async function ensureSubcategory(categoryId, name) {
  const [existing] = await db.select().from(subcategories).where(and(eq(subcategories.categoryId, categoryId), eq(subcategories.name, name)));
  if (existing) return existing;
  const [created] = await db.insert(subcategories).values({ categoryId, name }).returning();
  return created;
}

async function ensureAccount(name, kind, ignoreInTotals, isDefault) {
  const [existing] = await db.select().from(accounts).where(eq(accounts.name, name));
  if (existing) return existing;
  const [created] = await db.insert(accounts).values({ name, kind, ignoreInTotals, isDefault }).returning();
  return created;
}

async function ensureCreditCard(name, accountName, opts) {
  const account = await ensureAccount(accountName, 'checking', false, false);
  const [existing] = await db.select().from(creditCards).where(eq(creditCards.name, name));
  if (existing) return existing;
  const [created] = await db.insert(creditCards).values({ accountId: account.id, name, ...opts }).returning();
  return created;
}

for (const [name, isGeneric] of expenseCategories) {
  const cat = await ensureCategory(name, 'expense', isGeneric);
  for (const sub of expenseSubcategories[name] || []) await ensureSubcategory(cat.id, sub);
}
for (const [name, isGeneric] of incomeCategories) {
  const cat = await ensureCategory(name, 'income', isGeneric);
  for (const sub of incomeSubcategories[name] || []) await ensureSubcategory(cat.id, sub);
}

await ensureAccount('Main Account', 'checking', false, true);
await ensureAccount('Secondary Account', 'checking', false, false);
await ensureAccount('Digital Wallet', 'checking', false, false);
await ensureAccount('Cash Wallet', 'checking', false, false);
await ensureAccount('Fixed Income', 'investment', true, false);
await ensureAccount('Brokerage', 'broker', true, false);

await ensureCreditCard('Main Account card', 'Main Account', {
  brand: 'Mastercard', badge: 'MA', color: '#67b8f2', closureDay: 4, dueDay: 10, limitAmount: '5000.00'
});
await ensureCreditCard('Secondary Account card', 'Secondary Account', {
  brand: 'Mastercard', badge: 'SA', color: '#e5646d', closureDay: 4, dueDay: 10, limitAmount: '3000.00'
});
await ensureCreditCard('Cash Wallet card', 'Cash Wallet', {
  brand: 'Mastercard', badge: 'CW', color: '#5fd8cc', closureDay: 4, dueDay: 10, limitAmount: '2000.00'
});
await ensureCreditCard('Digital Wallet card', 'Digital Wallet', {
  brand: 'Visa', badge: 'DW', color: '#b794f6', closureDay: 2, dueDay: 10, limitAmount: '1000.00'
});

// Every checking account needs an opening-balance snapshot, otherwise the UI
// reads it as a flat 0 forever (see accountClosingAt in stores/finance.js).
// Dated far in the past so it works for any month; change it to a real value
// with scripts/set-opening-balance.js.
const checking = await db.select().from(accounts).where(eq(accounts.kind, 'checking'));
for (const account of checking) {
  const [existing] = await db.select().from(accountBalances).where(eq(accountBalances.accountId, account.id));
  if (!existing) await db.insert(accountBalances).values({ accountId: account.id, asOf: '2000-01-01', balance: '0.00' });
}

console.log('Taxonomy, accounts and cards seeded.');
await client.end();
