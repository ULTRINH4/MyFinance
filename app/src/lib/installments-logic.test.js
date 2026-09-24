import { describe, it, expect } from 'vitest';
import { splitInstallments, splitTotal, addMonths, addDays, rescheduleInstallments } from './installments-logic.js';

describe('splitInstallments', () => {
  it('splits the total evenly, with the last installment absorbing the rounding remainder', () => {
    const rows = splitInstallments(100, '2026-08-10', 1, 3, 'monthly');
    expect(rows.map((r) => r.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBeCloseTo(100, 2);
  });

  it('advances due dates monthly by default', () => {
    const rows = splitInstallments(300, '2026-01-31', 1, 3, 'monthly');
    // Jan 31 -> Feb has no 31st, clamps to the last real day of the month.
    expect(rows.map((r) => r.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('advances due dates weekly when frequency is weekly', () => {
    const rows = splitInstallments(200, '2026-08-01', 1, 2, 'weekly');
    expect(rows.map((r) => r.dueDate)).toEqual(['2026-08-01', '2026-08-08']);
  });

  it('honors a start other than 1 (mid-purchase entry point)', () => {
    const rows = splitInstallments(400, '2026-08-10', 3, 4, 'monthly');
    expect(rows.map((r) => r.installmentNumber)).toEqual([3, 4]);
    expect(rows[0].dueDate).toBe('2026-08-10');
  });
});

describe('splitInstallments — card invoice months', () => {
  it('advances month by month from a day-01 base, across the year boundary', () => {
    const rows = splitInstallments(400, '2026-11-01', 1, 4, 'monthly');
    expect(rows.map((r) => r.dueDate.slice(0, 7))).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });
});

describe('splitTotal', () => {
  it('re-splits a new total evenly, last entry absorbs the remainder', () => {
    expect(splitTotal(100, 3)).toEqual([33.33, 33.33, 33.34]);
  });
  it('handles a single installment (whole amount, no split)', () => {
    expect(splitTotal(50, 1)).toEqual([50]);
  });
});

describe('addMonths / addDays', () => {
  it('addMonths rolls over into the next year', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
  it('addDays crosses a month boundary', () => {
    expect(addDays('2026-08-28', 5)).toBe('2026-09-02');
  });
});

describe('rescheduleInstallments', () => {
  const group = [
    { id: 1, installmentNumber: 1, dueDate: '2026-09-18', confirmed: false },
    { id: 2, installmentNumber: 2, dueDate: '2026-10-18', confirmed: false },
    { id: 3, installmentNumber: 3, dueDate: '2026-11-18', confirmed: false }
  ];

  it('moves the whole group when the first installment gets a new date', () => {
    expect(rescheduleInstallments(group, 1, '2026-10-10')).toEqual([
      { id: 1, dueDate: '2026-10-10' },
      { id: 2, dueDate: '2026-11-10' },
      { id: 3, dueDate: '2026-12-10' }
    ]);
  });

  it('anchors on the edited installment (earlier ones move back too)', () => {
    expect(rescheduleInstallments(group, 2, '2026-10-10').map((r) => r.dueDate)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10']);
  });

  it('leaves already-confirmed installments untouched', () => {
    const paid = group.map((g) => (g.id === 1 ? { ...g, confirmed: true } : g));
    expect(rescheduleInstallments(paid, 2, '2026-10-10').map((r) => r.id)).toEqual([2, 3]);
  });

  it('keeps weekly spacing when the group was weekly', () => {
    const weekly = [
      { id: 1, installmentNumber: 1, dueDate: '2026-09-01', confirmed: false },
      { id: 2, installmentNumber: 2, dueDate: '2026-09-08', confirmed: false }
    ];
    expect(rescheduleInstallments(weekly, 1, '2026-09-10').map((r) => r.dueDate)).toEqual(['2026-09-10', '2026-09-17']);
  });

  it('returns nothing when the date did not change', () => {
    expect(rescheduleInstallments(group, 1, '2026-09-18')).toEqual([]);
  });
});
