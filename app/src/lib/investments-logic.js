// Pure aggregation for the Investments tab — no server/db import on purpose,
// so it stays unit-testable under Vitest without a DB (same constraint as
// the rest of finance.js's testable pieces). Consumed by
// $lib/server/finance-data.js (real data, server-side) and by
// investments-logic.test.js (fixture data).
//
// An "investment" is just a transfer transaction into/out of an account of
// kind 'investment' or 'broker' — no separate positions table. Contributed
// is net principal (inflows minus outflows); currentValue additionally
// tracks yield (income rows on the account) and fees (expense rows).
// Broker positions are derived by summing stock_purchase legs per ticker.

const NAME_META = {
  'Fixed Income': { badge: 'FI', color: '#a78bfa' },
  'Brokerage': { badge: 'BR', color: '#c084fc' }
};
const FALLBACK_COLORS = ['#60a5fa', '#7fd18f', '#f0b76d', '#fb7185', '#5cc9c7'];

function metaFor(name) {
  if (NAME_META[name]) return NAME_META[name];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { badge: name.slice(0, 2).toUpperCase(), color: FALLBACK_COLORS[hash % FALLBACK_COLORS.length] };
}

// Manual balances (Map accountId → { accumulated, redeemable, invested,
// updatedAt }) are the source of truth for what the UI shows once the user
// has filled them in — they replace the computed contributed/currentValue
// and never interact with transactions. Until an account has one, the
// computed values below stay as the fallback. Pending transfers (aporte /
// retirada waiting for the user to mark them as done) are ignored by the
// computed math and surfaced separately as `pendingMovements`.
//
// accountsMeta: [{ id, name, kind }] — the investment/broker accounts.
// transactions: fe-shaped rows with { type, account, destinationAccount, amount, date, transferKind, stockTicker, stockShares }.
export function computeInvestmentAccounts(transactions, accountsMeta, availableMonths, balances = new Map()) {
  return accountsMeta.map((acc) => {
    const own = transactions
      .filter((t) => t.account === acc.name || t.destinationAccount === acc.name)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));

    const positions = new Map();
    function applyPosition(ticker, shares, cost, sign) {
      if (!ticker) return;
      const existing = positions.get(ticker) || { shares: 0, cost: 0 };
      existing.shares += sign * shares;
      existing.cost += sign * cost;
      positions.set(ticker, existing);
    }

    let contributed = 0;
    let currentValue = 0;
    const monthlyValues = [];
    for (const month of availableMonths) {
      for (const t of own) {
        if (!t.date.startsWith(month) || t.status === 'pending') continue;
        const incoming = t.destinationAccount === acc.name;
        if (t.type === 'transfer') {
          const sign = incoming ? 1 : -1;
          contributed += sign * t.amount;
          currentValue += sign * t.amount;
          if (t.stockTicker) applyPosition(t.stockTicker, Number(t.stockShares) || 0, t.amount, sign);
        } else if (t.type === 'income' && t.account === acc.name) {
          currentValue += t.amount;
        } else if (t.type === 'expense' && t.account === acc.name) {
          currentValue -= t.amount;
        }
      }
      monthlyValues.push(currentValue);
    }

    const meta = metaFor(acc.name);
    const manual = balances.get(acc.id) || null;
    const shownCurrent = manual ? manual.accumulated : currentValue;
    const shownContributed = manual ? manual.invested : contributed;

    const positionList = acc.kind === 'broker'
      ? [...positions.entries()]
          .filter(([, p]) => Math.abs(p.shares) > 0.0001)
          .map(([ticker, p]) => ({ ticker, shares: Number(p.shares.toFixed(4)), avgPrice: p.cost / p.shares, currentPrice: p.cost / p.shares }))
      : (shownContributed !== 0 || shownCurrent !== 0)
        ? [{ name: 'Fixed income', product: 'Fixed income', value: shownCurrent }]
        : [];

    // Every transfer touching the account, newest first — the details modal
    // shows the latest 10, the Investments page lists all pending ones.
    const allMovements = own
      .filter((t) => t.type === 'transfer')
      .map((t) => ({ id: t.id, direction: t.destinationAccount === acc.name ? 'in' : 'out', amount: t.amount, date: t.date, status: t.status === 'pending' ? 'pending' : 'paid', note: t.note }))
      .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));

    return {
      id: acc.id, name: acc.name, kind: acc.kind, badge: meta.badge, color: meta.color,
      contributed: shownContributed, currentValue: shownCurrent,
      redeemable: manual ? manual.redeemable : null,
      manual: Boolean(manual),
      updatedAt: manual ? manual.updatedAt : null,
      monthlyValues, positions: positionList,
      movements: allMovements.slice(0, 10),
      pendingMovements: allMovements.filter((m) => m.status === 'pending')
    };
  });
}
