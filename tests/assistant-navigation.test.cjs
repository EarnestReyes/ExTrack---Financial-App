const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {})(name => {
    assert.ok(name in mocks, 'Unexpected import: ' + name); return mocks[name];
  }, module, module.exports);
  return module.exports;
}
function fixture() {
  const events = {}, cleanups = [], calls = [];
  const state = { signedIn: true, focused: true, segments: ['(tabs)', 'home'], keyboard: false, dismissals: 0 };
  const opening = { current: false };
  const Button = load('src/components/layout/GlobalAIAssistantButton.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: () => [state.keyboard, value => { state.keyboard = value; }], useRef: () => opening, useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { router: { navigate: route => calls.push(route) }, useIsFocused: () => state.focused, usePathname: () => state.pathname ?? '/home', useSegments: () => state.segments },
    'react-native': { Keyboard: { isVisible: () => state.keyboard, dismiss: () => { state.dismissals++; }, addListener: (name, fn) => { events[name] = fn; return { remove: () => { delete events[name]; } }; } }, Platform: { OS: 'ios' }, Pressable: 'Button', View: 'View', StyleSheet: { create: x => x } },
    '../../contexts/AuthContext': { useAuth: () => ({ user: state.signedIn ? { uid: 'A' } : null }) },
    '../../hooks/use-design-theme': { useDesignTheme: () => ({ colors: { surface: '#fff', accent: '#365CCA' } }) },
  }).GlobalAIAssistantButton;
  return { state, events, calls, cleanups, render: () => Button() };
}
test('One accessible assistant opens the existing route on every main tab; rapid taps deduplicate', () => {
  const f = fixture();
  for (const page of ['home', 'activity', 'insights', 'explore']) {
    f.state.segments = ['(tabs)', page];
    const button = f.render().props.children;
    assert.equal(f.render().props.style.marginBottom, 12);
    assert.equal(button.props.accessibilityLabel, 'Open ExTrack assistant');
    const style = button.props.style({ pressed: false })[0];
    assert.ok(style.width >= 48 && style.height >= 48);
    button.props.onPress(); button.props.onPress();
  }
  assert.equal(f.calls.length, 4); assert.ok(f.calls.every(route => route === '/ChatSupport'));
  assert.equal(f.state.dismissals, 4);
});
test('Assistant hides outside main tabs, when unfocused, signed out or the keyboard is open', () => {
  const f = fixture();
  for (const segments of [[], ['index'], ['register'], ['onboarding'], ['ChatSupport'], ['help'], ['(tabs)', 'home', 'modal']]) {
    f.state.segments = segments; assert.equal(f.render(), null);
  }
  f.state.segments = ['(tabs)', 'home'];
  f.state.pathname = '/ChatSupport'; assert.equal(f.render(), null);
  f.state.pathname = '/ChatSupport/'; assert.equal(f.render(), null);
  f.state.pathname = '/home';
  f.state.signedIn = false; assert.equal(f.render(), null); f.state.signedIn = true;
  f.state.focused = false; assert.equal(f.render(), null); f.state.focused = true;
  f.render(); f.events.keyboardWillShow(); assert.equal(f.render(), null);
  f.events.keyboardWillHide(); assert.notEqual(f.render(), null);
  f.cleanups.forEach(cleanup => cleanup()); assert.equal(Object.keys(f.events).length, 0);
});
test('Shared dock overlays one assistant and reserves only measured navigation plus safe area', () => {
  const Tabs = 'Tabs';
  let measured;
  const component = load('src/components/layout/floating-tabs.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx }, '@expo/vector-icons': { Ionicons: 'Icon' },
    react: { useState: initial => [measured ?? initial, value => { measured = value; }] },
    'expo-router': { Tabs, router: {} },
    'react-native': { Pressable: 'Button', Text: 'Text', View: 'View', StyleSheet: { create: x => x } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34, left: 24, right: 24 }) },
    '../../hooks/use-design-theme': { useDesignTheme: () => ({ colors: {} }) },
    '../../hooks/use-reduced-motion': { useReducedMotion: () => true },
    './GlobalAIAssistantButton': { GlobalAIAssistantButton: 'Assistant' },
  }).default;
  const tabs = component();
  const dock = tabs.props.tabBar({ state: { routes: [], index: 0 }, navigation: {} });
  assert.equal(dock.props.style[0].position, 'absolute');
  assert.equal(dock.props.style[0].bottom, 0);
  assert.equal(dock.props.style[1].paddingBottom, 34); assert.equal(dock.props.style[1].paddingRight, 24);
  assert.equal(tabs.props.screenOptions.sceneStyle.paddingBottom, 106);
  dock.props.children[1].props.onLayout({ nativeEvent: { layout: { height: 90 } } });
  assert.equal(component().props.screenOptions.sceneStyle.paddingBottom, 124);
  assert.equal(dock.props.children.filter(child => child.type === 'Assistant').length, 1);
});
test('Shared dashboard applies measured safe-area padding once and preserves refresh', () => {
  const source = fs.readFileSync('src/features/dashboard/screens/DashboardScreen.tsx', 'utf8');
  assert.match(source, /const safeInsets = useSafeAreaInsets\(\)/);
  assert.match(source, /<View style=\{\[styles.container, \{ paddingTop: safeInsets.top, paddingLeft: safeInsets.left, paddingRight: safeInsets.right \}\]\}>/);
  assert.match(source, /onRefresh=\{onRefresh\}/);
  for (const wrapper of ['ActivityScreen', 'InsightsScreen']) assert.match(fs.readFileSync(`src/features/dashboard/screens/${wrapper}.tsx`, 'utf8'), /DashboardScreen/);
  const profile = fs.readFileSync('src/features/profile/screens/ProfileScreen.tsx', 'utf8');
  assert.match(profile, /edges=\{\["top", "left", "right", "bottom"\]\}/);
});
test('Chat route requires sign-in but not AI activation; Help entry remains available', () => {
  const file = 'src/app/_layout.tsx';
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let guards;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'Stack.Screen' && node.attributes.properties.some(p => p.name?.getText(source) === 'name' && p.initializer?.text === 'ChatSupport')) {
      guards = [];
      for (let parent = node.parent; parent; parent = parent.parent) if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(source) === 'Stack.Protected') guards.push(parent.openingElement.attributes.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(source); assert.equal(guards.length, 1); assert.match(guards[0], /!!user/); assert.doesNotMatch(guards[0], /supportChatEnabled/);
  const help = fs.readFileSync('src/features/settings/screens/HelpScreen.tsx', 'utf8');
  assert.doesNotMatch(help, /supportChatEnabled/); assert.match(help, /router.navigate\("\/ChatSupport"\)/);
});
