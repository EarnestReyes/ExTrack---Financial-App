const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function render(enabled = false, signedIn = true) {
  const alerts = [];
  let calls = 0;
  let messages = [];
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: value => [value, next => { if (Array.isArray(value)) messages = typeof next === 'function' ? next(messages) : next; }], useRef: value => ({ current: value }), useEffect() {} },
    'react-native': { ActivityIndicator: 'Spinner', Alert: { alert: (...args) => alerts.push(args) }, FlatList: 'List', Keyboard: { dismiss() {} }, KeyboardAvoidingView: 'Keyboard', Platform: { OS: 'ios' }, StyleSheet: { create: x => x, hairlineWidth: 1 }, Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
    'expo-router': { router: { push() {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    './FinancialContextPreview': { FinancialContextPreview: 'FinancialPreview' },
    './LocalReplyBubble': { LocalReplyBubble: 'LocalReply' },
    '../readLocalContext': { readLocalContext: () => null },
    '../../../components/ui/safe-modal': { SafeModal: 'Modal' },
    '../../../contexts/AuthContext': { useAuth: () => ({ user: signedIn ? { uid: 'A' } : null }) },
    '../../../services/ai/supportService': { supportChatEnabled: enabled, supportUsesWorker: true, sendSupportMessage: () => { calls++; }, SupportError: Error },
  };
  function load(file) {
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { requestAnimationFrame: callback => callback() })(name => name in mocks ? mocks[name] : load(path.resolve(path.dirname(file), name + '.ts')), module, module.exports);
    return module.exports;
  }
  const component = load(path.resolve('src/features/ai-chat/components/ChatSupport.tsx')).default;
  const tree = component({ visible: true, onClose() {} });
  const nodes = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    nodes.push(node); walk(node.props?.children); walk(node.props?.ListEmptyComponent);
  }
  walk(tree);
  return { nodes, alerts, get calls() { return calls; }, get messages() { return messages; } };
}

test('Disabled AI leaves local financial questions usable without network or consent prompts', () => {
  const f = render();
  const suggestions = f.nodes.filter(n => n.type === 'Button' && n.props.accessibilityHint);
  assert.equal(suggestions.length, 4);
  for (const button of suggestions) button.props.onPress();
  assert.equal(f.alerts.length, 0);
  assert.equal(f.calls, 0);
  assert.equal(f.messages.length, 8);
  assert.ok(f.messages.filter(m => m.role === 'model').every(m => m.local && /ON-DEVICE FACTS/.test(m.text) && /GENERAL EDUCATION/.test(m.text)));
  assert.match(f.messages[1].text, /unavailable/);
  const send = f.nodes.find(n => n.props?.accessibilityLabel === 'Send message');
  assert.equal(send.props.disabled, true); send.props.onPress(); assert.equal(f.calls, 0);
  assert.equal(f.nodes.find(n => n.type === 'Input').props.editable, true);
});
test('Empty chat is honest about personal analysis and respects sign-in and keyboard states', () => {
  for (const signedIn of [false, true]) {
    const f = render(true, signedIn);
    assert.equal(f.nodes.find(n => n.type === 'Input').props.editable, signedIn);
    const list = f.nodes.find(n => n.type === 'List');
    assert.equal(list.props.data.length, 0);
    assert.equal(list.props.keyboardDismissMode, 'interactive');
    assert.equal(f.nodes.some(n => typeof n.props?.children === 'string' && n.props.children.includes('not Gemini')), true);
  }
});

test('Structured replies preserve PHP values and relevant warnings while details remain accessible', () => {
  let expanded = false;
  const alerts = [];
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: () => [expanded, value => { expanded = value; }] },
    'react-native': { Alert: { alert: (...args) => alerts.push(args) }, StyleSheet: { create: x => x, hairlineWidth: 1 }, Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
    '../../../constants/design': { getDesignTheme: () => ({}) },
  };
  const file = 'src/features/ai-chat/components/LocalReplyBubble.tsx';
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(name => { assert.ok(name in mocks); return mocks[name]; }, module, module.exports);
  const reply = { source: 'local', facts: ['Recorded income: PHP 1,234.50.', 'Income less expenses: PHP -10.25.', 'Some categories are omitted; this list is not total spending.'], guidance: 'Educational suggestion.', limitation: 'Some records require review and were excluded. Detailed caveat.' };
  const render = () => module.exports.LocalReplyBubble({ reply, dark: true });
  const nodes = [];
  const walk = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); nodes.push(node); walk(node.props?.children); };
  walk(render());
  const texts = nodes.filter(n => n.type === 'Text').map(n => n.props.children).join(' ');
  assert.match(texts, /PHP 1,234.50/); assert.match(texts, /PHP -10.25/);
  assert.match(texts, /Some categories are omitted/); assert.match(texts, /Some records were excluded/);
  assert.doesNotMatch(texts, /Detailed caveat|Educational suggestion/);
  nodes.find(n => n.props?.accessibilityLabel === 'Read limitations for this reply').props.onPress();
  assert.equal(alerts[0][1], reply.limitation);
  nodes.find(n => n.props?.accessibilityState?.expanded === false).props.onPress();
  nodes.length = 0; walk(render());
  assert.equal(nodes.some(n => n.props?.children === reply.guidance), true);
});
