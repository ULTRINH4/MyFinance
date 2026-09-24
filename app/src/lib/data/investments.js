// Investment accounts — real data now (see investments-logic.js /
// finance-data.js): populated from Postgres by initFinance() in
// finance.js, same pattern as transactions/creditCardsStore. The write
// helpers (addInvestment / withdrawInvestment / saveInvestmentBalances) live
// in finance.js next to applyServerData, which applies the server's
// recomputed accounts back onto this store (never trusts local math).

import { writable } from 'svelte/store';

export const investmentAccounts = writable([]);
