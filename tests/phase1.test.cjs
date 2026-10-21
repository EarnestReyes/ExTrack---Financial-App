const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

// Transpile in memory. Tests never open an application/device database or use credentials.
function load(file, mocks = {}, globals = {}, cache = new Map()) {
  const filename = path.resolve(file);
  if (filename in mocks) return mocks[filename];
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const localRequire = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), name);
      const resolved = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find((candidate) => fs.existsSync(candidate));
      if (!resolved) throw new Error('Unresolved local test module: ' + name);
      return load(resolved, mocks, globals, cache);
    }
    return require(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { console, Date, Set, Map, Promise, Intl, AbortSignal, ...globals }, { filename })(localRequire, module, module.exports);
  return module.exports;
}
const finance = load('src/domain/finance.ts');
const entry = (extra = {}) => ({ firestoreId: 'one', name: 'Food', amount: 10, type: 'Expense', category: 'Food', date: '2026-10-20', time: '12:00', ...extra });

test('centavo conversion rejects unsafe and malformed money', () => {
  assert.equal(finance.moneyToCentavos('24000.01'), 2400001);
  assert.equal(finance.moneyToCentavos('0.10'), 10);
  for (const input of [0, -1, NaN, Infinity, '1.001', '', '1e5', '1,000', '999999999999999999']) assert.throws(() => finance.moneyToCentavos(input));
});
test('income, expenses, transfers, opening balances, and card summaries stay distinct', () => {
  const records = [entry({ firestoreId: 'income', type: 'Income', amount: 100 }), entry(),
    entry({ firestoreId: 'transfer', type: 'Transfer', amount: 50 }),
    entry({ firestoreId: 'opening', type: 'Opening Balance', amount: 200 }),
    entry({ firestoreId: 'card', name: 'Card Deposit: bank', category: 'Card', type: 'Income', amount: 1000 })];
  const totals = finance.summarize(records, '2026-10-01', '2026-10-31');
  assert.equal(totals.income, 100); assert.equal(totals.expenses, 10);
  assert.equal(totals.net, 90); assert.equal(totals.availableBalance, 290); assert.equal(totals.reviewCount, 1);
});
test('identities deduplicate by cloud ID, never by local numeric ID', () => {
  const merged = finance.mergeLedger([entry({ id: 1 })], [entry({ id: 999 }), entry({ id: 1, firestoreId: 'different' })]);
  assert.equal(merged.length, 2);
});
test('invalid legacy monetary data is excluded and flagged rather than fabricated', () => {
  const summary = finance.summarize([entry({ amount: Infinity })]);
  assert.equal(summary.expenses, 0); assert.equal(summary.reviewCount, 1);
});
test('decimal totals and charts agree across the whole month', () => {
  const records = Array.from({ length: 20 }, (_, i) => entry({ firestoreId: String(i), date: `2026-10-${String(i + 1).padStart(2, '0')}`, amount: 0.1 }));
  assert.equal(finance.summarize(records).expenses, 2);
  const chart = finance.chartData(records, 'Month', new Date(2026, 9, 20));
  assert.equal(chart.length, 20); assert.equal(chart.at(-1).balance, -2);
});
test('dates and local month boundaries are validated', () => {
  assert.equal(finance.validDate('2026-02-30'), false);
  assert.equal(finance.periodStart('Month', new Date(2026, 9, 20)), '2026-10-01');
  assert.equal(finance.localDate(new Date('2026-10-19T16:01:00Z')), '2026-10-20');
  assert.equal(finance.periodStart('Month', new Date('2026-09-30T16:01:00Z')), '2026-10-01');
  assert.equal(finance.scheduleDates('2026-01-30', 1, 12).firstDueDate, '2026-02-01');
  assert.equal(finance.scheduleDates('2026-01-31', 31, 2).endDate, '2026-02-28');
});
test('historical automatically generated loan expenses are preserved for review, never confirmed', () => {
  const row = entry({ automatic: true, loanId: 'legacy' });
  const summary = finance.summarize([row]);
  assert.equal(summary.expenses, 0); assert.equal(summary.reviewCount, 1);
  assert.equal(row.amount, 10);
});
const loan = { schemaVersion: 2, principalCentavos: 2400000, installmentCentavos: 210000, durationMonths: 12, startDate: '2026-01-01', firstDueDate: '2026-01-31', dueDay: 31 };
test('principal and scheduled total differ without invented interest', () => {
  const schedule = finance.loanSchedule('loan', loan, [], '2026-02-28');
  assert.equal(loan.principalCentavos, 2400000); assert.equal(schedule.totalScheduledCentavos, 2520000);
  assert.equal(schedule.installments[0].status, 'Overdue'); assert.equal(schedule.installments[1].status, 'Due');
  assert.equal(schedule.installments[2].status, 'Upcoming'); assert.equal(schedule.installments[1].dueDate, '2026-02-28');
  assert.equal(schedule.remainingCentavos, 2520000);
});
test('only a matching confirmed payment marks an installment paid', () => {
  const payments = [entry({ loanId: 'loan', installmentId: 'loan_1', amount: 2100, confirmedPayment: true })];
  const schedule = finance.loanSchedule('loan', loan, payments, '2026-02-28');
  assert.equal(schedule.installments[0].status, 'Paid'); assert.equal(schedule.confirmedPaymentCentavos, 210000);
  assert.equal(finance.loanSchedule('loan', { totalAmount: 24000 }, []), null);
});

function sqliteMock() {
  const opened = [], databases = new Map();
  return { opened, openDatabaseSync(name) {
    opened.push(name); assert.notEqual(name, 'extrack.db');
    if (databases.has(name)) return databases.get(name);
    const db = new DatabaseSync(':memory:');
    const wrapper = {
      execSync: (sql) => db.exec(sql),
      getFirstSync: (sql, parameters = []) => db.prepare(sql).get(...parameters),
      getAllSync: (sql, parameters = []) => db.prepare(sql).all(...parameters),
      runSync: (sql, parameters = []) => db.prepare(sql).run(...parameters),
      withTransactionSync(callback) { db.exec('BEGIN'); try { callback(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; } },
    };
    databases.set(name, wrapper); return wrapper;
  } };
}
test('real SQLite: user isolation, atomic outbox, and legacy preservation', () => {
  const sqlite = sqliteMock(), store = load('src/data/ownedStore.ts', { 'expo-sqlite': sqlite });
  store.writeOwned('A', 'transactions', 'tx', entry({ ownerUid: 'A' }), 'INSERT');
  assert.equal(store.readOwned('A', 'transactions').length, 1);
  assert.equal(store.readOwned('B', 'transactions').length, 0);
  assert.equal(store.readOwned(null, 'transactions').length, 0);
  assert.equal(store.pendingOwned('A').length, 1); assert.equal(store.pendingOwned('B').length, 0);
  assert.throws(() => store.writeOwned('B', 'transactions', 'tx', { ownerUid: 'A' }, 'INSERT'));
  assert.equal(sqlite.opened.includes('extrack.db'), false);
});
test('real SQLite: failed/repeated sync preserves pending rows and remote deletion cannot resurrect', () => {
  const store = load('src/data/ownedStore.ts', { 'expo-sqlite': sqliteMock() });
  store.writeOwned('A', 'transactions', 'tx', entry({ amount: 25 }), 'INSERT');
  store.reconcileOwned('A', 'transactions', [{ id: 'tx', data: entry({ amount: 99 }) }]);
  assert.equal(store.readOwned('A', 'transactions')[0].amount, 25);
  store.acknowledgeOwned('A', store.pendingOwned('A')[0]);
  store.reconcileOwned('A', 'transactions', [{ id: 'tx', data: entry({ amount: 25 }) }]);
  store.reconcileOwned('A', 'transactions', [{ id: 'tx', data: entry({ amount: 25 }) }]);
  assert.equal(store.readOwned('A', 'transactions').length, 1);
  store.writeOwned('A', 'transactions', 'tx', entry({ amount: 25 }), 'DELETE');
  store.reconcileOwned('A', 'transactions', [{ id: 'tx', data: entry({ amount: 25 }) }]);
  assert.equal(store.readOwned('A', 'transactions').length, 0);
  assert.throws(() => store.acknowledgeOwned('B', store.pendingOwned('A')[0]));
  store.acknowledgeOwned('A', store.pendingOwned('A')[0]);
  store.reconcileOwned('A', 'transactions', []);
  assert.equal(store.readOwned('A', 'transactions').length, 0);
});

function backend() {
  const records = new Map(), secrets = { GEMINI_API_KEY: 'test-only', SMTP_USER: 'test-only', SMTP_PASSWORD: 'test-only' };
  const params = { GEMINI_SUPPORT_MODEL: 'gemini-2.5-flash-lite', AI_ENABLED: 'true', AI_FREE_TIER_VERIFIED: 'true' };
  let chain = Promise.resolve(), fetchImpl = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Help response' }] } }] }) });
  const store = { doc: (id) => ({ path: id, id: id.split('/').at(-1) }), runTransaction(callback) {
    const next = chain.then(async () => {
      const writes = [];
      const result = await callback({ get: async (ref) => ({ exists: records.has(ref.path), data: () => records.get(ref.path) }),
        set: (ref, value) => writes.push([ref.path, value]), create: (ref, value) => { assert.equal(records.has(ref.path), false); writes.push([ref.path, value]); } });
      for (const [key, value] of writes) records.set(key, value);
      return result;
    }); chain = next.catch(() => {}); return next;
  } };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const callable = (options, handler) => Object.assign(handler, { options });
  const functions = load('functions/src/index.ts', {
    'firebase-functions/v2/https': { onCall: callable, HttpsError },
    'firebase-functions/params': { defineSecret: (name) => ({ value: () => secrets[name] }), defineString: (name) => ({ value: () => params[name] }) },
    'firebase-admin/app': { initializeApp() {}, getApps: () => [] },
    'firebase-admin/firestore': { getFirestore: () => store },
    nodemailer: { createTransport: () => ({ sendMail: async () => {} }) },
  }, { fetch: (...args) => fetchImpl(...args) });
  return { functions, records, secrets, params, setFetch: (fn) => { fetchImpl = fn; } };
}
const request = (data, uid = 'A') => ({ auth: { uid, token: { email: 'test@example.invalid', email_verified: true } }, data: data?.messages ? { consent: true, policyVersion: "free-tier-v1", ...data } : data });
test('backend rejects unauthenticated and oversized support requests', async () => {
  const { functions } = backend();
  await assert.rejects(functions.supportChat({ data: {} }), { code: 'unauthenticated' });
  await assert.rejects(functions.supportChat(request({ messages: [{ role: 'user', text: 'x'.repeat(2001) }] })), { code: 'invalid-argument' });
  assert.equal(functions.supportChat.options.enforceAppCheck, true);
});
test('support accepts consecutive conversations and sanitizes provider/network failures', async () => {
  const b = backend();
  const data = { messages: [{ role: 'user', text: 'How do I add an expense?' }] };
  assert.equal((await b.functions.supportChat(request(data))).text, 'Help response');
  assert.equal((await b.functions.supportChat(request({ messages: [...data.messages, { role: 'model', text: 'Help response' }, { role: 'user', text: 'And edit it?' }] }))).text, 'Help response');
  b.setFetch(async () => { throw new Error('private provider detail'); });
  await assert.rejects(b.functions.supportChat(request(data)), (e) => e.code === 'unavailable' && !e.message.includes('private'));
  b.setFetch(async () => ({ ok: false }));
  await assert.rejects(b.functions.supportChat(request(data)), { code: 'unavailable' });
});
test('missing provider secret fails closed and rate limit persists across requests', async () => {
  const b = backend(), data = { messages: [{ role: 'user', text: 'Help' }] };
  b.secrets.GEMINI_API_KEY = '';
  await assert.rejects(b.functions.supportChat(request(data)), { code: 'unavailable' });
  b.secrets.GEMINI_API_KEY = 'test-only';
  for (let i = 0; i < 5; i++) await b.functions.supportChat(request(data));
  await assert.rejects(b.functions.supportChat(request(data)), { code: 'resource-exhausted' });
});
test('atomic payment confirmation is idempotent under concurrent taps and retries', async () => {
  const b = backend(); b.records.set('users/A/loans/loan', { ...loan, ownerUid: 'A', title: 'Test loan' });
  const results = await Promise.all(Array.from({ length: 8 }, () => b.functions.confirmLoanPayment(request({ loanId: 'loan', number: 1 }))));
  assert.equal(results.filter((r) => !r.alreadyConfirmed).length, 1);
  const payments = [...b.records.entries()].filter(([key]) => key.includes('/transactions/'));
  assert.equal(payments.length, 1); assert.equal(payments[0][1].amountCentavos, 210000);
  await assert.rejects(b.functions.confirmLoanPayment(request({ loanId: 'loan', number: 1 }, 'B')), { code: 'failed-precondition' });
  await assert.rejects(b.functions.confirmLoanPayment(request({ loanId: 'loan', number: 13 })), { code: 'failed-precondition' });
});
test('legacy loan confirmation is blocked without altering historical fields', async () => {
  const b = backend(), legacy = { totalAmount: 24000, monthlyPayment: 2000 };
  b.records.set('users/A/loans/old', legacy);
  await assert.rejects(b.functions.confirmLoanPayment(request({ loanId: 'old', number: 1 })), { code: 'failed-precondition' });
  assert.deepEqual(b.records.get('users/A/loans/old'), legacy);
});

function applicationStore() {
  const sqlite = sqliteMock(), owned = load('src/data/ownedStore.ts', { 'expo-sqlite': sqlite });
  const auth = { currentUser: { uid: 'A' } }, remote = new Map();
  let offline = false, nextId = 0, failAfterCommit = false;
  const ref = (...args) => ({ path: args.filter((x) => typeof x === 'string').join('/') });
  const cloud = {
    collection: ref,
    doc(...args) { return args.length === 1 ? { path: args[0].path + '/new' + (++nextId), id: 'new' + nextId } : ref(...args); },
    onSnapshot: () => () => {},
    deleteDoc: async (r) => { if (offline) throw Error('offline'); remote.delete(r.path); },
    getDocsFromServer: async (r) => {
      if (offline) throw Error('offline');
      return { docs: [...remote.entries()].filter(([key]) => key.startsWith(r.path + '/') && !key.slice(r.path.length + 1).includes('/')).map(([key, value]) => ({ id: key.split('/').at(-1), data: () => value })) };
    },
    runTransaction: async (_db, callback) => {
      if (offline) throw Error('offline');
      await callback({ get: async (r) => ({ exists: () => remote.has(r.path), data: () => remote.get(r.path) }),
        set: (r, value) => remote.set(r.path, structuredClone(value)),
        update: (r, value) => remote.set(r.path, { ...remote.get(r.path), ...structuredClone(value) }) });
      if (failAfterCommit) { failAfterCommit = false; throw Error('lost acknowledgment'); }
    },
  };
  const database = load('src/database.ts', {
    'expo-sqlite': sqlite, '@react-native-community/netinfo': { addEventListener() {} },
    'firebase/firestore': cloud, 'firebase/auth': { onAuthStateChanged() {} },
    'firebase/functions': { getFunctions() {}, httpsCallable: () => async () => ({}) },
    [path.resolve('src/services/firebase/client.ts')]: { auth, app: {}, db: {} },
    [path.resolve('src/database/connection.ts')]: owned,
    [path.resolve('src/database/repositories/ownedRecordRepository.ts')]: owned,
    [path.resolve('src/database/sync/syncQueue.ts')]: owned,
    [path.resolve('src/domain/finance.ts')]: finance,
  });
  return { database, owned, auth, remote, setOffline: (value) => { offline = value; }, loseAck: () => { failAfterCommit = true; } };
}
test('application: offline writes survive account switching and replay only to original UID', async () => {
  const b = applicationStore(); b.setOffline(true);
  await b.database.insertTransactionToDB(entry({ firestoreId: undefined }));
  await assert.rejects(b.database.syncFromFirestore());
  assert.equal(b.database.fetchTransactionsFromDB().length, 1);
  b.auth.currentUser = { uid: 'B' };
  assert.equal(b.database.fetchTransactionsFromDB().length, 0);
  b.setOffline(false); await b.database.syncFromFirestore();
  assert.equal(b.remote.size, 0); assert.equal(b.owned.pendingOwned('A').length, 1);
  b.auth.currentUser = null; assert.equal(b.database.fetchTransactionsFromDB().length, 0);
  b.auth.currentUser = { uid: 'A' }; await b.database.syncFromFirestore();
  assert.equal(b.remote.size, 1); assert.equal(b.owned.pendingOwned('A').length, 0);
  assert.ok([...b.remote.keys()][0].startsWith('users/A/transactions/'));
});
test('application: lost acknowledgments retry without duplicating or overwriting cloud records', async () => {
  const b = applicationStore(); b.loseAck();
  await b.database.insertTransactionToDB(entry({ firestoreId: undefined }));
  await assert.rejects(b.database.syncFromFirestore());
  await b.database.syncFromFirestore();
  assert.equal(b.remote.size, 1); assert.equal(b.database.fetchTransactionsFromDB().length, 1);
  assert.equal(b.owned.pendingOwned('A').length, 0);
});
test('application: edits preserve category and loan references; numeric ID cannot select another row', async () => {
  const b = applicationStore();
  b.remote.set('users/A/transactions/old', entry({ firestoreId: undefined, ownerUid: 'A', loanId: 'loan', id: 42 }));
  await b.database.syncFromFirestore();
  const before = b.database.fetchTransactionsFromDB()[0];
  await b.database.updateTransactionInDB({ ...before, name: 'Edited', loanId: null });
  await b.database.syncFromFirestore();
  const after = b.remote.get('users/A/transactions/old');
  assert.equal(after.category, 'Food'); assert.equal(after.loanId, 'loan'); assert.equal(after.name, 'Edited');
  await assert.rejects(b.database.updateTransactionInDB({ ...before, firestoreId: undefined }));
});
test('application: remote deletions hide recoverable copies and failed edits never resurrect them', async () => {
  const b = applicationStore();
  b.remote.set('users/A/transactions/old', entry({ ownerUid: 'A' }));
  await b.database.syncFromFirestore();
  const row = b.database.fetchTransactionsFromDB()[0];
  b.setOffline(true); await b.database.updateTransactionInDB({ ...row, name: 'Pending edit' });
  await assert.rejects(b.database.syncFromFirestore());
  b.remote.clear(); b.setOffline(false);
  await assert.rejects(b.database.syncFromFirestore());
  assert.equal(b.remote.size, 0); assert.equal(b.owned.pendingOwned('A').length, 1);
});
test('application: explicit deletion synchronizes once and preserves the tombstone', async () => {
  const b = applicationStore();
  b.remote.set('users/A/transactions/old', entry({ ownerUid: 'A' }));
  await b.database.syncFromFirestore();
  await b.database.deleteTransactionFromDB(9999, 'old'); await b.database.syncFromFirestore();
  await b.database.syncFromFirestore();
  assert.equal(b.remote.size, 0); assert.equal(b.database.fetchTransactionsFromDB().length, 0);
});
test('application: card summaries sync through owned outbox without creating income', async () => {
  const b = applicationStore(); b.setOffline(true);
  await b.database.insertCardToDB({ name: 'Test card', type: 'Debit', lastFour: '1234', expiry: '12/30', amount: 1000 });
  await assert.rejects(b.database.syncFromFirestore());
  assert.equal(b.database.fetchCardsFromDB().length, 1);
  assert.equal(b.database.fetchTransactionsFromDB().length, 0);
  b.setOffline(false); await b.database.syncFromFirestore();
  const card = b.database.fetchCardsFromDB()[0];
  await b.database.updateCardInDB({ ...card, amount: 2000 }); await b.database.syncFromFirestore();
  assert.equal(b.database.fetchCardsFromDB()[0].amount, 2000);
  assert.equal(b.database.fetchTransactionsFromDB().length, 0);
});

function chatHarness(enabled = true, consent = true) {
  let cursor = 0, calls = 0, user = { uid: 'A' }, resolve, reject;
  const hooks = [], effects = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial; return [hooks[index], (value) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; },
    useEffect(callback, dependencies) { const index = cursor++; if (!hooks[index] || dependencies.some((value, i) => hooks[index].dependencies[i] !== value)) { const previous = hooks[index]; hooks[index] = { dependencies }; effects.push(() => { previous?.cleanup?.(); hooks[index].cleanup = callback(); }); } },
  };
  const components = Object.fromEntries(['Text', 'TouchableOpacity', 'View', 'Modal', 'TextInput', 'FlatList', 'KeyboardAvoidingView', 'ActivityIndicator'].map((name) => [name, name]));
  const jsx = (type, props) => ({ type, props });
  const Component = load('src/features/ai-chat/components/ChatSupport.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ...components, StyleSheet: { create: (styles) => styles }, Platform: { OS: 'android' }, Keyboard: { dismiss() {} }, Alert: { alert(title, message, buttons) { return consent ? buttons?.find(button => button.text === "Send to Google")?.onPress?.() : undefined; } } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../../../contexts/AuthContext': { useAuth: () => ({ user }) },
    '../../../services/ai/supportService': { supportChatEnabled: enabled, sendSupportMessage: async () => { calls++; return new Promise((yes, no) => { resolve = yes; reject = no; }); } },
  }).default;
  function render() { cursor = 0; const tree = Component({ visible: true, onClose() {} }); effects.splice(0).forEach((run) => run()); return tree; }
  function find(tree, predicate) { if (!tree) return null; if (Array.isArray(tree)) return tree.map((child) => find(child, predicate)).find(Boolean); if (predicate(tree)) return tree; return find(tree.props?.children, predicate); }
  render();
  return { hooks, render, find, get calls() { return calls; }, reply(text) { resolve(text); }, fail() { reject(new Error('network unavailable')); },
    switchAccount(uid) { user = uid ? { uid } : null; render(); },
    type(text) { find(render(), (node) => node.type === 'TextInput').props.onChangeText(text); },
    send() { return find(render(), (node) => node.type === 'TouchableOpacity' && node.props.children?.props?.children === 'Send').props.onPress(); } };
}
test('chat component: success/failure cleanup permits consecutive messages and blocks double taps', async () => {
  const chat = chatHarness(); chat.type('How do I add income?');
  const first = chat.send(), duplicate = chat.send();
  assert.equal(chat.calls, 1); assert.equal(chat.hooks[2], true);
  chat.reply('Use Add Transaction.'); await Promise.all([first, duplicate]);
  assert.equal(chat.hooks[2], false);
  chat.type('And expenses?'); const second = chat.send(); assert.equal(chat.calls, 2);
  chat.fail(); await second; assert.equal(chat.hooks[2], false);
  chat.type('Try again'); const third = chat.send(); chat.reply('Select Expense.'); await third;
  assert.equal(chat.hooks[2], false); assert.equal(chat.calls, 3);
});
test('chat component: account change clears history and discards old responses', async () => {
  const chat = chatHarness(); chat.type('A question'); const pending = chat.send();
  chat.switchAccount('B'); chat.reply('Old account answer'); await pending;
  assert.equal(chat.hooks[0].length, 1); assert.equal(chat.hooks[2], false);
});
test('chat component: missing configuration, empty input, and signed-out state make no request', async () => {
  const chat = chatHarness(false); chat.type('Help'); await chat.send(); assert.equal(chat.calls, 0);
  const enabled = chatHarness(); enabled.type('   '); await enabled.send();
  enabled.switchAccount(null); enabled.type('Help'); await enabled.send(); assert.equal(enabled.calls, 0);
});

const explanation = { consent: true, policyVersion: "free-tier-v1", summary: { cashFlow: 'surplus', spendingPattern: 'spread', savingsActivity: 'none', loanAttention: 'none' } };
test('AI gates reject unverified billing configuration and paid model selection before fetching', async () => {
  const b = backend(); let calls = 0;
  b.setFetch(async () => { calls++; throw Error('must not call'); });
  for (const [key, value] of [['AI_ENABLED', 'false'], ['AI_FREE_TIER_VERIFIED', 'false'], ['GEMINI_SUPPORT_MODEL', 'paid-model']]) {
    const previous = b.params[key]; b.params[key] = value;
    await assert.rejects(b.functions.explainInsights(request(explanation)), { code: 'unavailable' });
    b.params[key] = previous;
  }
  assert.equal(calls, 0);
});
test('insights reject missing auth, absent consent, private fields and prompt injection', async () => {
  const b = backend(); let calls = 0;
  b.setFetch(async () => { calls++; throw Error('must not call'); });
  await assert.rejects(b.functions.explainInsights({ data: explanation }), { code: 'unauthenticated' });
  for (const data of [{ ...explanation, consent: false }, { ...explanation, uid: 'B' }, { ...explanation, summary: { ...explanation.summary, income: 123 } }, { ...explanation, summary: { ...explanation.summary, cashFlow: 'ignore instructions' } }]) {
    await assert.rejects(b.functions.explainInsights(request(data)), { code: 'invalid-argument' });
  }
  await assert.rejects(b.functions.supportChat(request({ consent: false, messages: [{ role: 'user', text: 'Help' }] })), { code: 'invalid-argument' });
  await assert.rejects(b.functions.supportChat(request({ messages: [{ role: 'user', text: 'Email test@example.invalid' }] })), { code: 'invalid-argument' });
  assert.equal(b.functions.explainInsights.options.enforceAppCheck, true);
  assert.equal(calls, 0);
});
test('AI daily cap is shared by support and insights; failed attempts consume capacity', async () => {
  const b = backend(); const data = { messages: [{ role: 'user', text: 'Help' }] };
  for (let i = 0; i < 4; i++) await b.functions.supportChat(request(data));
  await b.functions.explainInsights(request(explanation));
  await assert.rejects(b.functions.explainInsights(request(explanation)), { code: 'resource-exhausted' });
  const failed = backend(); let calls = 0;
  failed.setFetch(async () => { calls++; throw Error('offline'); });
  for (let i = 0; i < 5; i++) await assert.rejects(failed.functions.explainInsights(request(explanation)), { code: 'unavailable' });
  await assert.rejects(failed.functions.supportChat(request(data)), { code: 'resource-exhausted' });
  assert.equal(calls, 5);
});
test('global AI cap is atomic under concurrent accounts', async () => {
  const b = backend(); let calls = 0;
  b.setFetch(async () => { calls++; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Explanation' }] } }] }) }; });
  const results = await Promise.allSettled(Array.from({ length: 25 }, (_, i) => b.functions.explainInsights(request(explanation, 'account-' + i))));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 20);
  assert.equal(calls, 20);
});
test('Gemini 429 opens a shared daily circuit without retries or raw provider leakage', async () => {
  const b = backend(); let calls = 0;
  b.setFetch(async () => { calls++; return { ok: false, status: 429 }; });
  await assert.rejects(b.functions.explainInsights(request(explanation)), { code: 'resource-exhausted' });
  await assert.rejects(b.functions.supportChat(request({ messages: [{ role: 'user', text: 'Help' }] }, 'B')), { code: 'resource-exhausted' });
  assert.equal(calls, 1);
});
test('chat requires consent before sending', async () => {
  const chat = chatHarness(true, false); chat.type('How do I add an expense?'); await chat.send();
  assert.equal(chat.calls, 0); assert.equal(chat.hooks[2], false);
});
test('offline monthly insights use deterministic ledger rules and never serialize records', () => {
  const { buildLocalInsights } = load('src/features/insights/services/localInsights.ts');
  const entries = [entry({ firestoreId: 'income', type: 'Income', amount: 1000 }), entry({ firestoreId: 'food', amount: 200 }), entry({ firestoreId: 'saving', category: 'Savings', amount: 100 }), entry({ firestoreId: 'legacy', category: 'Card', amount: 5000 })];
  const result = buildLocalInsights(entries, [loan], new Date('2026-10-20T12:00:00+08:00'));
  assert.equal(result.monthly.income, 1000); assert.equal(result.monthly.expenses, 300);
  assert.equal(result.monthly.net, 700); assert.equal(result.savingsAllocations, 100);
  assert.equal(result.breakdown[0][0], 'Food'); assert.equal(result.monthly.reviewCount, 1);
  assert.equal(result.principal, loan.principalCentavos / 100);
  assert.equal(Object.keys(result.summary).length, 4);
  assert.equal(/1000|Food|Savings|2026|firestoreId/.test(JSON.stringify(result.summary)), false);
});

test('client release gate stays off despite old support flags; no requests are made', async () => {
  let calls = 0;
  const service = load('src/services/ai/supportService.ts', {
    'firebase/functions': { getFunctions() { calls++; }, httpsCallable() { calls++; } },
    '../firebase/client': { app: {}, auth: { currentUser: { uid: 'A' } } },
  }, { process: { env: { EXPO_PUBLIC_SUPPORT_CHAT_ENABLED: 'true', EXPO_PUBLIC_AI_INSIGHTS_ENABLED: 'true' } } });
  assert.equal(service.supportChatEnabled, false); assert.equal(service.financialInsightsAIEnabled, false);
  await assert.rejects(service.sendSupportMessage([{ role: 'user', text: 'Help' }]));
  await assert.rejects(service.explainFinancialSummary(explanation.summary));
  assert.equal(calls, 0);
});
test('financial explanation provider payload contains only allowed labels and fixed model', async () => {
  const b = backend(); let body;
  b.setFetch(async (url, options) => {
    assert.match(url, /models\/gemini-2\.5-flash-lite:generateContent$/);
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Read your verified figures in Insights.' }] } }] }) };
  });
  await b.functions.explainInsights(request(explanation));
  assert.equal(JSON.stringify(JSON.parse(body.contents[0].parts[0].text)), JSON.stringify(explanation.summary));
  assert.equal(body.generationConfig.maxOutputTokens, 512);
  assert.equal(body.tools, undefined);
  await assert.rejects(b.functions.explainInsights(request({ ...explanation, policyVersion: undefined })), { code: 'invalid-argument' });
});
