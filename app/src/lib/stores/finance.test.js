import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  initFinance,
  transactions,
  selectedMonth,
  isAccountExpense,
  isSpendingTransaction,
  accountOpeningAt,
  accountClosingAt,
  installmentSiblings,
  taxonomy,
  transactionSummary
} from './finance.js';

// Small, self-contained fixture: two months with real statement snapshots
// (Main Account) plus one month past the real coverage that must fall back to
// summing paid transactions — mirrors the shape finance-data.js actually
// sends (see docs/frontend.md "Contas — saldo negativo indevido").
function mockData(overrides = {}) {
  return {
    availableMonths: ['2026-01', '2026-02', '2026-03'],
    monthOpenings: { '2026-01': 100, '2026-02': 200 },
    accountOpenings: { 'Main Account': { '2026-01': 100, '2026-02': 200 } },
    transactions: [],
    cards: [
      {
        id: 'card-1',
        name: 'Main Account card',
        account: 'Main Account',
        invoices: {},
        nextInvoices: {},
        paidMonths: []
      }
    ],
    ...overrides
  };
}

beforeEach(() => {
  initFinance(mockData());
  selectedMonth.set('2026-01');
});

describe('isAccountExpense / isSpendingTransaction', () => {
  it('isSpendingTransaction counts both expense and card, but never a settlement row', () => {
    expect(isSpendingTransaction({ type: 'expense' })).toBe(true);
    expect(isSpendingTransaction({ type: 'card' })).toBe(true);
    expect(isSpendingTransaction({ type: 'card', cardPayment: true })).toBe(false);
    expect(isSpendingTransaction({ type: 'income' })).toBe(false);
  });

  it('isAccountExpense: direct expenses always count, income never does', () => {
    expect(isAccountExpense({ type: 'expense' })).toBe(true);
    expect(isAccountExpense({ type: 'income' })).toBe(false);
  });

  it('a settlement row from the historical import never counts — it coexists with purchases already counted individually under the old reconciliation, counting it too would double the hit', () => {
    expect(isAccountExpense({ type: 'expense', cardPayment: true, source: 'import' })).toBe(false);
  });

  it('a settlement row registered through the app (Register payment) counts as a real account debit', () => {
    expect(isAccountExpense({ type: 'expense', cardPayment: true, source: 'app' })).toBe(true);
  });

  it('a card purchase counts normally when its card+month has no registered app payment (the vast majority — untouched legacy behavior)', () => {
    initFinance(mockData());
    expect(isAccountExpense({ type: 'card', cardId: 'card-1', dueDate: '2026-01-15' })).toBe(true);
  });

  it('a card purchase is excluded once its own card+month has a registered app payment, so it is never counted alongside the settlement that now represents it', () => {
    initFinance(mockData({
      transactions: [
        { id: 99, type: 'expense', cardPayment: true, source: 'app', status: 'paid', local: 'Main Account card', account: 'Main Account', amount: 500, date: '2026-01-10', dueDate: '2026-01-10' }
      ]
    }));
    expect(isAccountExpense({ type: 'card', cardId: 'card-1', dueDate: '2026-01-20' })).toBe(false);
    // A different month on the same card is completely unaffected.
    expect(isAccountExpense({ type: 'card', cardId: 'card-1', dueDate: '2026-02-20' })).toBe(true);
  });

  it('an unconfirmed (pending) registered payment does not exclude its purchases — undoing the confirm toggle undoes the exclusion too', () => {
    initFinance(mockData({
      transactions: [
        { id: 99, type: 'expense', cardPayment: true, source: 'app', status: 'pending', local: 'Main Account card', account: 'Main Account', amount: 500, date: '2026-01-10', dueDate: '2026-01-10' }
      ]
    }));
    expect(isAccountExpense({ type: 'card', cardId: 'card-1', dueDate: '2026-01-20' })).toBe(true);
  });
});

describe('accountMonthDelta via accountClosingAt — the actual balance math end to end', () => {
  it('a paid card purchase debits the account once, matching the legacy (pre-registration) model', () => {
    initFinance(mockData({
      transactions: [
        { id: 1, type: 'card', cardId: 'card-1', account: 'Main Account', amount: 80, status: 'paid', date: '2026-02-05', dueDate: '2026-02-05' }
      ]
    }));
    expect(accountClosingAt('Main Account', '2026-02')).toBe(120); // 200 - 80
  });
  it('registering the payment for that same purchase does not double the hit — settlement replaces the purchase, same net effect', () => {
    initFinance(mockData({
      transactions: [
        { id: 1, type: 'card', cardId: 'card-1', account: 'Main Account', amount: 80, status: 'paid', date: '2026-02-05', dueDate: '2026-02-05' },
        { id: 2, type: 'expense', cardPayment: true, source: 'app', status: 'paid', local: 'Main Account card', account: 'Main Account', amount: 80, date: '2026-02-10', dueDate: '2026-02-10' }
      ]
    }));
    expect(accountClosingAt('Main Account', '2026-02')).toBe(120); // still 200 - 80, not 200 - 160
  });
});

describe('transactionSummary.expenses.total', () => {
  it('does not double-count a card invoice that was settled via Register payment', () => {
    initFinance(mockData({
      cards: [
        {
          id: 'card-1',
          name: 'Main Account card',
          account: 'Main Account',
          invoices: { '2026-02': 80 },
          nextInvoices: {},
          paidMonths: ['2026-02']
        }
      ],
      transactions: [
        { id: 1, type: 'card', cardId: 'card-1', account: 'Main Account', category: 'Leisure · Games', amount: 80, status: 'paid', date: '2026-02-05', dueDate: '2026-02-05' },
        { id: 2, type: 'expense', cardPayment: true, source: 'app', status: 'paid', local: 'Main Account card', category: 'Credit cards · Invoice payment', account: 'Main Account', amount: 80, date: '2026-02-10', dueDate: '2026-02-10' }
      ]
    }));
    selectedMonth.set('2026-02');
    // The invoice (80) already covers this purchase — the settlement row must
    // not add another 80 on top, same "replaces, doesn't add" rule already
    // enforced for account balances (see accountClosingAt tests above).
    expect(get(transactionSummary).expenses.total).toBe(80);
  });

  it('executed = total minus pending, so a paid invoice counts fully and a pending one does not', () => {
    initFinance(mockData({
      cards: [
        { id: 'card-1', name: 'Main Account card', account: 'Main Account', invoices: { '2026-02': 80 }, nextInvoices: {}, paidMonths: ['2026-02'] },
        { id: 'card-2', name: 'Nubank', account: 'Main Account', invoices: { '2026-02': 30 }, nextInvoices: {}, paidMonths: [] }
      ],
      transactions: [
        { id: 1, type: 'card', cardId: 'card-1', account: 'Main Account', category: 'Leisure · Games', amount: 80, status: 'paid', date: '2026-02-05', dueDate: '2026-02-05' },
        { id: 2, type: 'expense', cardPayment: true, source: 'app', status: 'paid', local: 'Main Account card', category: 'Credit cards · Invoice payment', account: 'Main Account', amount: 80, date: '2026-02-10', dueDate: '2026-02-10' },
        { id: 3, type: 'card', cardId: 'card-2', account: 'Main Account', category: 'Food · Restaurant', amount: 30, status: 'pending', date: '2026-02-12', dueDate: '2026-02-20' },
        { id: 4, type: 'expense', local: 'Rent', category: 'Bills · Rent', account: 'Main Account', amount: 50, status: 'paid', date: '2026-02-01', dueDate: '2026-02-01' }
      ]
    }));
    selectedMonth.set('2026-02');
    const summary = get(transactionSummary);
    expect(summary.expenses.total).toBe(160); // 80 (paid invoice) + 30 (pending invoice) + 50 (paid rent)
    expect(summary.expenses.pending).toBe(30);
    expect(summary.expenses.executed).toBe(130); // 80 + 50, the pending invoice excluded
  });
});

describe('accountOpeningAt / accountClosingAt', () => {
  it('reads the real snapshot directly when the month is covered', () => {
    expect(accountOpeningAt('Main Account', '2026-01')).toBe(100);
    expect(accountOpeningAt('Main Account', '2026-02')).toBe(200);
  });
  it("a month's closing balance is just next month's real opening", () => {
    expect(accountClosingAt('Main Account', '2026-01')).toBe(200);
  });
  it('falls back to opening + paid income/expenses/transfers once real coverage ends', () => {
    initFinance(mockData({
      transactions: [
        { id: 1, type: 'income', account: 'Main Account', amount: 50, status: 'paid', date: '2026-02-10', dueDate: '2026-02-10' },
        { id: 2, type: 'expense', account: 'Main Account', amount: 30, status: 'paid', date: '2026-02-15', dueDate: '2026-02-15' },
        // pending rows must NOT affect the closing balance
        { id: 3, type: 'expense', account: 'Main Account', amount: 999, status: 'pending', date: '2026-02-20', dueDate: '2026-02-20' }
      ]
    }));
    // 2026-03 has no real snapshot -> closing(2026-02) = opening(200) + 50 - 30 = 220
    expect(accountClosingAt('Main Account', '2026-02')).toBe(220);
    expect(accountOpeningAt('Main Account', '2026-03')).toBe(220);
  });
  it('an account with no statement ever imported always reads as flat R$0 (Digital Wallet/Cash Wallet case)', () => {
    initFinance(mockData({
      transactions: [
        { id: 1, type: 'income', account: 'Digital Wallet', amount: 500, status: 'paid', date: '2026-01-05', dueDate: '2026-01-05' }
      ]
    }));
    expect(accountOpeningAt('Digital Wallet', '2026-01')).toBe(0);
    expect(accountClosingAt('Digital Wallet', '2026-01')).toBe(0);
    expect(accountOpeningAt('Digital Wallet', '2026-03')).toBe(0);
  });
  it('credited/debited transfers move the per-account balance in the fallback path', () => {
    initFinance(mockData({
      transactions: [
        { id: 1, type: 'transfer', account: 'Main Account', destinationAccount: 'Secondary Account', amount: 40, status: 'paid', date: '2026-02-01', dueDate: '2026-02-01' }
      ]
    }));
    expect(accountClosingAt('Main Account', '2026-02')).toBe(160); // 200 - 40
  });
});

describe('installmentSiblings', () => {
  it('returns every row of the group sorted by installment number, regardless of store order', () => {
    transactions.set([
      { id: 3, type: 'expense', local: 'Notebook', amount: 33.34, installmentNumber: 3, installmentGroupId: 'g1', date: '2026-03-10', dueDate: '2026-03-10' },
      { id: 1, type: 'expense', local: 'Notebook', amount: 33.33, installmentNumber: 1, installmentGroupId: 'g1', date: '2026-01-10', dueDate: '2026-01-10' },
      { id: 2, type: 'expense', local: 'Notebook', amount: 33.33, installmentNumber: 2, installmentGroupId: 'g1', date: '2026-02-10', dueDate: '2026-02-10' },
      { id: 4, type: 'expense', local: 'Other purchase', amount: 10, date: '2026-01-05', dueDate: '2026-01-05' }
    ]);
    const siblings = installmentSiblings('g1');
    expect(siblings.map((s) => s.installmentNumber)).toEqual([1, 2, 3]);
    expect(siblings.every((s) => s.local === 'Notebook')).toBe(true);
  });
});

describe('taxonomy', () => {
  it('splits the real "Cat · Sub" category string into a per-type category → subcategory map', () => {
    transactions.set([
      { id: 1, type: 'expense', category: 'Leisure · 3D', amount: 10, date: '2026-01-01', dueDate: '2026-01-01' },
      { id: 2, type: 'expense', category: 'Leisure · Gym', amount: 10, date: '2026-01-01', dueDate: '2026-01-01' },
      { id: 3, type: 'expense', category: 'Food', amount: 10, date: '2026-01-01', dueDate: '2026-01-01' },
      { id: 4, type: 'income', category: 'Salary', amount: 10, date: '2026-01-01', dueDate: '2026-01-01' }
    ]);
    const t = get(taxonomy);
    expect(t.expense.Leisure.sort()).toEqual(['3D', 'Gym']);
    expect(t.expense.Food).toEqual([]);
    expect(t.income.Salary).toEqual([]);
    expect(t.income.Leisure).toBeUndefined();
  });
  it('excludes "Credit cards" — technical-only, never a pickable category in the form', () => {
    transactions.set([
      { id: 1, type: 'expense', category: 'Credit cards · Invoice payment', amount: 10, date: '2026-01-01', dueDate: '2026-01-01' }
    ]);
    expect(get(taxonomy).expense['Credit cards']).toBeUndefined();
  });
  it('includes card purchases (client type "card") under expense — a category only ever bought on a card must still appear', () => {
    transactions.set([
      { id: 1, type: 'card', category: 'Leisure · Games', amount: 10, date: '2026-01-01', dueDate: '2026-01-01' }
    ]);
    expect(get(taxonomy).expense.Leisure).toEqual(['Games']);
  });
});
