import { describe, it, expect } from 'vitest';
import { computeInvestmentAccounts } from './investments-logic.js';

const ACCOUNTS = [
  { id: 5, name: 'Fixed Income', kind: 'investment' },
  { id: 6, name: 'Brokerage', kind: 'broker' }
];
const MONTHS = ['2026-06', '2026-07', '2026-08'];

function tx(overrides) {
  return { type: 'transfer', account: '', destinationAccount: undefined, amount: 0, date: '2026-06-01', transferKind: null, stockTicker: null, stockShares: null, ...overrides };
}

describe('computeInvestmentAccounts — fixed income account', () => {
  it('contributed nets inflows against redemptions', () => {
    const transactions = [
      tx({ account: 'Main Account', destinationAccount: 'Fixed Income', amount: 2000, date: '2026-06-26', transferKind: 'transfer' }),
      tx({ account: 'Fixed Income', destinationAccount: 'Main Account', amount: 500, date: '2026-07-10', transferKind: 'redemption' })
    ];
    const [acc] = computeInvestmentAccounts(transactions, ACCOUNTS.slice(0, 1), MONTHS);
    expect(acc.contributed).toBe(1500);
  });

  it('yield (income rows) grows currentValue without touching contributed', () => {
    const transactions = [
      tx({ account: 'Main Account', destinationAccount: 'Fixed Income', amount: 1000, date: '2026-06-01', transferKind: 'transfer' }),
      { type: 'income', account: 'Fixed Income', destinationAccount: undefined, amount: 87.59, date: '2026-06-26' }
    ];
    const [acc] = computeInvestmentAccounts(transactions, ACCOUNTS.slice(0, 1), MONTHS);
    expect(acc.contributed).toBe(1000);
    expect(acc.currentValue).toBeCloseTo(1087.59, 2);
  });

  it('fees (expense rows) shrink currentValue only', () => {
    const transactions = [
      tx({ account: 'Main Account', destinationAccount: 'Fixed Income', amount: 1000, date: '2026-06-01', transferKind: 'transfer' }),
      { type: 'expense', account: 'Fixed Income', destinationAccount: undefined, amount: 1.31, date: '2026-06-26' }
    ];
    const [acc] = computeInvestmentAccounts(transactions, ACCOUNTS.slice(0, 1), MONTHS);
    expect(acc.contributed).toBe(1000);
    expect(acc.currentValue).toBeCloseTo(998.69, 2);
  });

  it('emits a single aggregated Fixed income position, none when untouched', () => {
    const [withActivity] = computeInvestmentAccounts([tx({ account: 'Main Account', destinationAccount: 'Fixed Income', amount: 500, date: '2026-06-01', transferKind: 'transfer' })], ACCOUNTS.slice(0, 1), MONTHS);
    expect(withActivity.positions).toEqual([{ name: 'Fixed income', product: 'Fixed income', value: 500 }]);
    const [untouched] = computeInvestmentAccounts([], ACCOUNTS.slice(0, 1), MONTHS);
    expect(untouched.positions).toEqual([]);
  });

  it('monthlyValues is a running snapshot, one entry per availableMonths', () => {
    const transactions = [
      tx({ account: 'Main Account', destinationAccount: 'Fixed Income', amount: 1000, date: '2026-06-01', transferKind: 'transfer' }),
      tx({ account: 'Main Account', destinationAccount: 'Fixed Income', amount: 500, date: '2026-08-01', transferKind: 'transfer' })
    ];
    const [acc] = computeInvestmentAccounts(transactions, ACCOUNTS.slice(0, 1), MONTHS);
    expect(acc.monthlyValues).toEqual([1000, 1000, 1500]);
  });
});

describe('computeInvestmentAccounts — broker account', () => {
  it('groups buys of the same ticker into one position, weighted avg price', () => {
    const transactions = [
      tx({ account: 'Main Account', destinationAccount: 'Brokerage', amount: 100, date: '2026-06-01', transferKind: 'stock_purchase', stockTicker: 'NVDC34', stockShares: '4' }),
      tx({ account: 'Main Account', destinationAccount: 'Brokerage', amount: 60, date: '2026-07-01', transferKind: 'stock_purchase', stockTicker: 'NVDC34', stockShares: '2' })
    ];
    const [acc] = computeInvestmentAccounts(transactions, [ACCOUNTS[1]], MONTHS);
    expect(acc.positions).toHaveLength(1);
    expect(acc.positions[0].shares).toBe(6);
    expect(acc.positions[0].avgPrice).toBeCloseTo(160 / 6, 4);
    expect(acc.contributed).toBe(160);
  });

  it('keeps different tickers as separate positions', () => {
    const transactions = [
      tx({ account: 'Main Account', destinationAccount: 'Brokerage', amount: 124.27, date: '2026-07-06', transferKind: 'stock_purchase', stockTicker: 'CSMG3F', stockShares: '2' }),
      tx({ account: 'Main Account', destinationAccount: 'Brokerage', amount: 76.53, date: '2026-07-06', transferKind: 'stock_purchase', stockTicker: 'PETR4F', stockShares: '2' })
    ];
    const [acc] = computeInvestmentAccounts(transactions, [ACCOUNTS[1]], MONTHS);
    expect(acc.positions.map((p) => p.ticker).sort()).toEqual(['CSMG3F', 'PETR4F']);
  });

  it('a fully-sold ticker drops out of the position list', () => {
    const transactions = [
      tx({ account: 'Main Account', destinationAccount: 'Brokerage', amount: 100, date: '2026-06-01', transferKind: 'stock_purchase', stockTicker: 'NVDC34', stockShares: '4' }),
      tx({ account: 'Brokerage', destinationAccount: 'Main Account', amount: 110, date: '2026-07-01', transferKind: 'redemption', stockTicker: 'NVDC34', stockShares: '4' })
    ];
    const [acc] = computeInvestmentAccounts(transactions, [ACCOUNTS[1]], MONTHS);
    expect(acc.positions).toEqual([]);
  });
});

describe('computeInvestmentAccounts — pending movements', () => {
  const pendingIn = tx({ id: 11, account: 'Main Account', destinationAccount: 'Fixed Income', amount: 300, date: '2026-08-05', transferKind: 'transfer', status: 'pending' });
  const paidIn = tx({ id: 10, account: 'Main Account', destinationAccount: 'Fixed Income', amount: 1000, date: '2026-07-05', transferKind: 'transfer', status: 'paid' });

  it('ignores pending transfers in the computed contributed/currentValue', () => {
    const [acc] = computeInvestmentAccounts([paidIn, pendingIn], ACCOUNTS.slice(0, 1), MONTHS);
    expect(acc.contributed).toBe(1000);
    expect(acc.currentValue).toBe(1000);
  });

  it('exposes pending transfers as pendingMovements with direction', () => {
    const out = tx({ id: 12, account: 'Fixed Income', destinationAccount: 'Main Account', amount: 50, date: '2026-08-06', transferKind: 'redemption', status: 'pending' });
    const [acc] = computeInvestmentAccounts([paidIn, pendingIn, out], ACCOUNTS.slice(0, 1), MONTHS);
    expect(acc.pendingMovements.map((m) => [m.id, m.direction, m.amount])).toEqual([[12, 'out', 50], [11, 'in', 300]]);
  });

  it('movements lists the 10 latest transfers, newest first, pending included', () => {
    const many = Array.from({ length: 12 }, (_, i) => tx({ id: i + 1, account: 'Main Account', destinationAccount: 'Fixed Income', amount: 10, date: `2026-06-${String(i + 1).padStart(2, '0')}`, transferKind: 'transfer', status: i === 11 ? 'pending' : 'paid' }));
    const [acc] = computeInvestmentAccounts(many, ACCOUNTS.slice(0, 1), MONTHS);
    expect(acc.movements).toHaveLength(10);
    expect(acc.movements[0]).toMatchObject({ id: 12, status: 'pending', direction: 'in' });
    expect(acc.movements[9].id).toBe(3);
  });
});

describe('computeInvestmentAccounts — manual balances', () => {
  const transactions = [tx({ id: 1, account: 'Main Account', destinationAccount: 'Fixed Income', amount: 2000, date: '2026-06-26', transferKind: 'transfer', status: 'paid' })];
  const balances = new Map([[5, { accumulated: 2150.5, redeemable: 2100, invested: 2000, updatedAt: '2026-09-21T10:00:00Z' }]]);

  it('manual values replace computed contributed/currentValue and expose redeemable', () => {
    const [acc] = computeInvestmentAccounts(transactions, ACCOUNTS.slice(0, 1), MONTHS, balances);
    expect(acc).toMatchObject({ contributed: 2000, currentValue: 2150.5, redeemable: 2100, manual: true, updatedAt: '2026-09-21T10:00:00Z' });
    expect(acc.positions[0].value).toBe(2150.5);
  });

  it('falls back to computed values (manual: false) until balances exist', () => {
    const [acc] = computeInvestmentAccounts(transactions, ACCOUNTS.slice(0, 1), MONTHS);
    expect(acc).toMatchObject({ contributed: 2000, currentValue: 2000, redeemable: null, manual: false, updatedAt: null });
  });

  it('a manual balance only affects its own account', () => {
    const accs = computeInvestmentAccounts(transactions, ACCOUNTS, MONTHS, balances);
    expect(accs[1].manual).toBe(false);
  });
});
