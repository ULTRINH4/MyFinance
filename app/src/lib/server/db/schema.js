import { pgTable, pgEnum, serial, text, integer, smallint, boolean, numeric, date, timestamp, uuid, unique, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  privateMode: boolean('private_mode').notNull().default(false),
  oidcSubject: text('oidc_subject').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: serial('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const transactionTypeEnum = pgEnum('transaction_type', ['expense', 'income', 'transfer']);
export const accountKindEnum = pgEnum('account_kind', ['checking', 'investment', 'broker']);
export const recurrenceTypeEnum = pgEnum('recurrence_type', ['none', 'installment', 'fixed']);
export const transferKindEnum = pgEnum('transfer_kind', ['transfer', 'stock_purchase', 'redemption', 'credit_card_payment']);

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  kind: accountKindEnum('kind').notNull().default('checking'),
  ignoreInTotals: boolean('ignore_in_totals').notNull().default(false),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const creditCards = pgTable('credit_cards', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  name: text('name').notNull(),
  brand: text('brand'),
  badge: text('badge'),
  color: text('color'),
  closureDay: smallint('closure_day').notNull(),
  dueDay: smallint('due_day').notNull(),
  limitAmount: numeric('limit_amount', { precision: 12, scale: 2 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: transactionTypeEnum('type').notNull(),
  isGeneric: boolean('is_generic').notNull().default(true)
}, (t) => [unique().on(t.name, t.type)]);

export const subcategories = pgTable('subcategories', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  name: text('name').notNull()
}, (t) => [unique().on(t.categoryId, t.name)]);

export const accountBalances = pgTable('account_balances', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  asOf: date('as_of').notNull(),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull()
}, (t) => [unique().on(t.accountId, t.asOf)]);

export const locals = pgTable('locals', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  usageCount: integer('usage_count').notNull().default(0),
  lastCategoryId: integer('last_category_id').references(() => categories.id),
  lastSubcategoryId: integer('last_subcategory_id').references(() => subcategories.id),
  lastAccountId: integer('last_account_id').references(() => accounts.id),
  lastAmount: numeric('last_amount', { precision: 12, scale: 2 }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true })
});

// One row per "fixed monthly" series (identified by localId+type, same key
// used to match siblings in the PATCH fixedSeries/onwards branch). Absence
// of a row means the series follows the global default horizon in
// finance-data.js (FIXED_RECURRING_HORIZON) instead of a custom end month.
export const fixedSeriesSettings = pgTable('fixed_series_settings', {
  id: serial('id').primaryKey(),
  localId: integer('local_id').notNull().references(() => locals.id),
  type: transactionTypeEnum('type').notNull(),
  endMonth: date('end_month').notNull(),
  // Set when the series was "stopped" from /fixed-monthly — hides it from
  // that list entirely (history/transactions are untouched). No unarchive
  // UI on purpose: flip this back to false directly in Postgres if a
  // stopped series needs to resume.
  archived: boolean('archived').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [unique().on(t.localId, t.type)]);

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  type: transactionTypeEnum('type').notNull(),

  localId: integer('local_id').references(() => locals.id),
  categoryId: integer('category_id').references(() => categories.id),
  subcategoryId: integer('subcategory_id').references(() => subcategories.id),

  accountId: integer('account_id').references(() => accounts.id),
  destinationAccountId: integer('destination_account_id').references(() => accounts.id),
  creditCardId: integer('credit_card_id').references(() => creditCards.id),

  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  entryDate: date('entry_date'),
  effectiveDate: date('effective_date'),
  invoiceMonth: date('invoice_month'),

  note: text('note'),
  items: jsonb('items'),
  confirmed: boolean('confirmed').notNull().default(true),

  recurrence: recurrenceTypeEnum('recurrence').notNull().default('none'),
  installmentNumber: smallint('installment_number'),
  installmentTotal: smallint('installment_total'),
  installmentGroupId: uuid('installment_group_id'),

  isRecurringSubscription: boolean('is_recurring_subscription').notNull().default(false),
  isInternalTransfer: boolean('is_internal_transfer').notNull().default(false),
  ignoreInTotals: boolean('ignore_in_totals').notNull().default(false),
  isChargeback: boolean('is_chargeback').notNull().default(false),

  transferKind: transferKindEnum('transfer_kind'),
  stockTicker: text('stock_ticker'),
  stockShares: numeric('stock_shares', { precision: 12, scale: 4 }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Was defaultNow()-only, meaning it was set once on insert and never
  // touched again by any UPDATE — found 04/09/2026 while building Activity:
  // editing a transaction changed its values but never this column, so
  // there was no way to tell "recently edited" from "recently created" at
  // all. $onUpdate makes Drizzle set this on every .update() automatically,
  // no per-call-site changes needed.
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),

  // Who/what wrote this row — 'app' (default, anything through the normal
  // endpoints below), 'import' (the historical CSV load, 24-25/08/2026), or
  // 'agent' (a direct SQL statement run outside the app, e.g. for debugging
  // or cleanup — always set this explicitly on those, never leave it to
  // default to 'app'). Added 04/09/2026 after a debugging session produced
  // duplicate rows with no way to tell which ones were real.
  source: text('source').notNull().default('app')
});

// Manual, informational balances per investment account — deliberately not
// derived from transactions (see investments-logic.js). The table is created
// by ensureInvestmentBalances() in db/index.js (idempotent), since this
// project has no migrations folder and dev + prod share one database.
export const investmentBalances = pgTable('investment_balances', {
  accountId: integer('account_id').primaryKey().references(() => accounts.id),
  accumulated: numeric('accumulated', { precision: 14, scale: 2 }).notNull(),
  redeemable: numeric('redeemable', { precision: 14, scale: 2 }).notNull(),
  invested: numeric('invested', { precision: 14, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
