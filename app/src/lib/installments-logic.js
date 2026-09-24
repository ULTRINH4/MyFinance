// Pure installment splitting/date math — no server/db import on purpose, so
// it stays unit-testable under Vitest without a DB (same pattern as
// investments-logic.js). Used by /transactions/+server.js for both the
// initial split (addInstallments) and re-splitting an edited total
// (updateInstallmentGroup).

export function addMonths(dateStr, count) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = (m - 1) + count;
  const newY = y + Math.floor(total / 12);
  const newM = (total % 12 + 12) % 12 + 1;
  const daysInMonth = new Date(newY, newM, 0).getDate();
  return `${newY}-${String(newM).padStart(2, '0')}-${String(Math.min(d, daysInMonth)).padStart(2, '0')}`;
}

export function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// One row per installment from `start` through `total`, due dates advancing
// monthly (or weekly) from `baseDue` — the last installment absorbs
// whatever the even split's rounding left over, so the parts always sum
// back to exactly `amount`.
export function splitInstallments(amount, baseDue, start, total, frequency) {
  const perInstallment = Math.round((amount / total) * 100) / 100;
  let allocated = 0;
  const rows = [];
  for (let n = start; n <= total; n++) {
    const isLast = n === total;
    const installmentAmount = isLast ? Number((amount - allocated).toFixed(2)) : perInstallment;
    allocated += perInstallment;
    const offset = n - start;
    const dueDate = frequency === 'weekly' ? addDays(baseDue, 7 * offset) : addMonths(baseDue, offset);
    rows.push({ installmentNumber: n, amount: installmentAmount, dueDate });
  }
  return rows;
}

// Re-splits a purchase TOTAL evenly across `count` existing installments —
// same rounding rule as splitInstallments, but no dates involved (due dates
// of existing installments never move when only the total changes).
export function splitTotal(newTotal, count) {
  const per = Math.round((newTotal / count) * 100) / 100;
  let allocated = 0;
  return Array.from({ length: count }, (_, index) => {
    const isLast = index === count - 1;
    const amount = isLast ? Number((newTotal - allocated).toFixed(2)) : per;
    allocated += per;
    return amount;
  });
}

// New due dates for an installment group after the user edits ONE
// installment's due date: the edited row lands on `newDueDate` and every
// sibling is re-derived from it by installment-number offset, so the whole
// purchase shifts together. Frequency isn't stored, so it's inferred from
// the existing spacing (7 days between the first two = weekly). Already
// confirmed (paid) siblings keep their date; the edited row always moves.
// Returns only the rows whose date actually changes.
export function rescheduleInstallments(siblings, editedId, newDueDate) {
  const sorted = [...siblings].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const edited = sorted.find((s) => s.id === editedId);
  if (!edited || !newDueDate) return [];
  const weekly = sorted.length > 1 && addDays(sorted[0].dueDate, 7 * (sorted[1].installmentNumber - sorted[0].installmentNumber)) === sorted[1].dueDate;
  const changes = [];
  for (const sib of sorted) {
    if (sib.id !== editedId && sib.confirmed) continue;
    const offset = sib.installmentNumber - edited.installmentNumber;
    const dueDate = weekly ? addDays(newDueDate, 7 * offset) : addMonths(newDueDate, offset);
    if (dueDate !== sib.dueDate) changes.push({ id: sib.id, dueDate });
  }
  return changes;
}
