import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '$env/dynamic/private';
import * as schema from './schema.js';

const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });

// Additive, idempotent DDL: dev and prod share this database and there is
// no migrations folder, so whichever container starts first creates the
// table and the other one no-ops. The old prod image just ignores it.
let investmentBalancesReady;
export function ensureInvestmentBalances() {
  investmentBalancesReady ??= client`
    CREATE TABLE IF NOT EXISTS investment_balances (
      account_id integer PRIMARY KEY REFERENCES accounts(id),
      accumulated numeric(14,2) NOT NULL,
      redeemable numeric(14,2) NOT NULL,
      invested numeric(14,2) NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`.then(() => undefined).catch((err) => { investmentBalancesReady = undefined; throw err; });
  return investmentBalancesReady;
}
