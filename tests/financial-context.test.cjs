const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const full = path.resolve(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(name => {
    assert.ok(name.startsWith('.'), 'Pure context must not import network or database runtime');
    return load(path.resolve(path.dirname(full), name + '.ts'));
  }, module, module.exports);
  return module.exports;
}
const { buildFinancialContext: build, validateFinancialContext: validate } = load('src/features/ai-chat/financialContext.ts');
const now = new Date('2026-10-23T04:00:00Z');
const entry = (id, amount, type = 'Expense', extra = {}) => ({ firestoreId: id, amount, type, name: 'Private merchant', category: 'Food', date: '2026-10-10', time: '12:00', ...extra });
const loan = { firestoreId: 'private-loan', title: 'Private lender', schemaVersion: 2, principalCentavos: 100000, installmentCentavos: 10000, durationMonths: 3, dueDay: 1, startDate: '2026-09-01', firstDueDate: '2026-09-01', endDate: '2026-11-01' };

test('Normal context reuses ledger rules, excludes transfers/openings and protects private fields', () => {
  const rows = [entry('salary', 1000, 'Income', { notes: 'private note', account: 'private-account' }), entry('food', 200), entry('transfer', 500, 'Transfer'), entry('opening', 9000, 'Opening Balance'), entry('custom', 30, 'Expense', { category: 'Private category' }), entry('saving', 40, 'Expense', { category: 'Savings' })];
  const data = build(rows, [], now);
  assert.equal(data.recordedIncomeCents, 100000); assert.equal(data.recordedExpenseCents, 27000);
  assert.equal(data.cashFlow.currentNetCents, 73000);
  assert.equal(data.categories.length, 1); assert.equal(data.categories[0].cents, 20000);
  assert.equal(data.quality.categoriesOmitted, true); assert.equal(data.quality.savingsNotVerified, true);
  assert.doesNotMatch(JSON.stringify(data), /Private|private|notes|ownerUid|firestoreId|account|Savings/);
  assert.doesNotThrow(() => validate(data));
});
test('No income, no expenses and unavailable inputs remain distinguishable', () => {
  const spendingOnly = build([entry('food', 5)], [], now);
  assert.equal(spendingOnly.recordedIncomeCents, 0); assert.equal(spendingOnly.quality.noRecordedIncome, true);
  const incomeOnly = build([entry('salary', 5, 'Income')], [], now);
  assert.equal(incomeOnly.recordedExpenseCents, 0); assert.equal(incomeOnly.quality.noRecordedExpenses, true);
  const missing = build(null, null, now);
  assert.equal(missing.recordedIncomeCents, null); assert.equal(missing.dueUnpaidLoanCents, null);
  assert.equal(missing.quality.ledgerUnavailable, true); assert.equal(missing.quality.noRecordedIncome, false);
  assert.equal(build([], [], now).cashFlow.priorNetCents, null);
});
test('Partial months compare identical elapsed days and never extrapolate missing history', () => {
  const data = build([entry('current', 20, 'Income'), entry('prior', 10, 'Income', { date: '2026-09-20' }), entry('later-prior', 500, 'Income', { date: '2026-09-24' })], [], now);
  assert.equal(data.period.partial, true); assert.equal(data.period.priorEnd, '2026-09-23');
  assert.equal(data.cashFlow.priorNetCents, 1000); assert.equal(data.cashFlow.comparableCurrentNetCents, 2000);
  const short = build([entry('current', 7, 'Income', { date: '2026-03-31' }), entry('earlier', 5, 'Income', { date: '2026-03-20' }), entry('prior', 3, 'Income', { date: '2026-02-28' })], [], new Date('2026-03-31T04:00:00Z'));
  assert.equal(short.period.comparisonCurrentEnd, '2026-03-28'); assert.equal(short.period.priorEnd, '2026-02-28');
  assert.equal(short.period.partial, false); assert.equal(short.cashFlow.currentNetCents, 1200); assert.equal(short.cashFlow.comparableCurrentNetCents, 500);
  assert.equal(short.period.completeness, 'unknown');
});
test('All due unpaid installments aggregate once; paid installments are not deducted twice', () => {
  const unpaid = build([], [loan, loan], now); assert.equal(unpaid.dueUnpaidLoanCents, 20000);
  const payment = entry('payment', 100, 'Expense', { loanId: loan.firestoreId, installmentId: loan.firestoreId + '_1', confirmedPayment: true });
  const paid = build([payment, payment], [loan], now);
  assert.equal(paid.recordedExpenseCents, 10000); assert.equal(paid.cashFlow.currentNetCents, -10000); assert.equal(paid.dueUnpaidLoanCents, 10000);
  const legacy = build([], [{ ...loan, schemaVersion: 1 }], now);
  assert.equal(legacy.dueUnpaidLoanCents, null); assert.equal(legacy.quality.legacyLoansExcluded, true);
});
test('Stable transaction identities deduplicate before calculations without mutating records', () => {
  const original = entry('same', 10);
  const before = JSON.stringify(original);
  assert.equal(build([original, { ...original }], [], now).recordedExpenseCents, 1000);
  assert.equal(JSON.stringify(original), before);
});
test('Invalid source amounts, dates, missing identities and aggregate overflow fail closed', () => {
  for (const amount of [-1, 0, NaN, Infinity, 1.001]) assert.throws(() => build([entry('invalid', amount)], [], now));
  assert.throws(() => build([entry('invalid', 1, 'Expense', { date: 'bad' })], [], now));
  assert.throws(() => build([entry(undefined, 1)], [], now));
  const huge = Array.from({ length: 1001 }, (_, i) => entry(String(i), 1000000000));
  assert.throws(() => build(huge, [], now));
});
test('Strict versioned validation rejects unknown and sensitive fields at every level', () => {
  const fresh = () => JSON.parse(JSON.stringify(build([entry('food', 10)], [], now)));
  for (const mutate of [x => { x.transactions = []; }, x => { x.period.ownerUid = 'secret'; }, x => { x.cashFlow.notes = 'secret'; }, x => { x.quality.secret = true; }, x => { x.categories[0].merchant = 'secret'; }, x => { x.categories[0].code = 'Private'; }, x => { x.categories[0].cents = null; }, x => { x.recordedIncomeCents = -1; }, x => { x.recordedIncomeCents = 1.5; }, x => { x.recordedIncomeCents = Number.MAX_SAFE_INTEGER; }, x => { x.currency = 'USD'; }, x => { x.period.priorEnd = '2026-09-22'; }]) {
    const data = fresh(); mutate(data); assert.throws(() => validate(data));
  }
});
test('Review-only and refund-like classifications are not reinterpreted as income or savings', () => {
  const data = build([entry('refund', 20, 'Refund'), entry('legacy', 10, 'Expense', { automatic: true })], [loan], now);
  assert.equal(data.recordedIncomeCents, 0); assert.equal(data.recordedExpenseCents, 0);
  assert.equal(data.quality.reviewRequired, true); assert.equal(data.quality.refundSemanticsUnknown, true);
  assert.equal(data.dueUnpaidLoanCents, null);
});
