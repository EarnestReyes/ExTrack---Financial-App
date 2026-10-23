const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('Preview reads only local data, refreshes on changes/foreground/day rollover and clears across accounts', () => {
  let snapshot, effect, listener, foreground, midnight, removed = 0, reads = 0;
  let amount = 10, fail = false;
  const jsx = (type, props) => ({ type, props });
  const fixedTime = Date.parse('2026-10-23T04:00:00Z');
  class Clock extends Date { constructor(value = fixedTime) { super(value); } static now() { return fixedTime; } }
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useState: initial => typeof initial === 'boolean' ? [true, () => {}] : [snapshot ?? initial, value => { snapshot = value; }],
      useEffect: callback => { effect = callback; },
    },
    'react-native': { AppState: { addEventListener: (_name, callback) => { foreground = callback; return { remove: () => { removed++; } }; } }, StyleSheet: { create: v => v, hairlineWidth: 1 }, Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
    '../../../database/repositories/ownedRecordRepository': { readOwned: (_uid, entity) => {
      reads++; if (fail) throw Error('Private local error');
      return entity === 'loans' ? [] : [{ firestoreId: 'private-record', name: 'Private merchant', category: 'Food', type: 'Expense', amount, date: '2026-10-10', time: '12:00' }];
    } },
    '../../../database/sync/events': { subscribeFinancialData: callback => { listener = callback; return () => { removed++; }; } },
  };
  function load(file) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { Date: Clock, setTimeout: callback => { midnight = callback; return 1; }, clearTimeout() {} })(name => {
      if (name in mocks) return mocks[name];
      assert.ok(name.startsWith('.'), 'No network/runtime services may be imported');
      return load(path.resolve(path.dirname(file), name + '.ts'));
    }, module, module.exports);
    return module.exports;
  }
  const { FinancialContextPreview: Preview } = load(path.resolve('src/features/ai-chat/components/FinancialContextPreview.tsx'));
  Preview({ owner: 'A', dark: true }); const cleanup = effect();
  assert.equal(snapshot.context.recordedExpenseCents, 1000);
  amount = 20; listener(); assert.equal(snapshot.context.recordedExpenseCents, 2000);
  amount = 30; foreground('active'); assert.equal(snapshot.context.recordedExpenseCents, 3000);
  amount = 40; midnight(); assert.equal(snapshot.context.recordedExpenseCents, 4000);
  const text = node => !node ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
  assert.match(text(Preview({ owner: 'A', dark: false })), /NOTHING SENT/);
  assert.doesNotMatch(text(Preview({ owner: 'B', dark: false })), /PHP 40/);
  assert.doesNotMatch(text(Preview({ owner: undefined, dark: false })), /PHP 40/);
  fail = true; listener(); assert.equal(snapshot.failed, true); assert.equal(snapshot.context, undefined);
  assert.doesNotMatch(text(Preview({ owner: 'A', dark: false })), /Private local error/);
  cleanup(); assert.equal(removed, 2);
  const count = reads; listener(); assert.equal(reads, count);
});
