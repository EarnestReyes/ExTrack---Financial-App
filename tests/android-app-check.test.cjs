const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { atob, ...globals }, { filename })(
    name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name + '.ts'), mocks, globals);
      throw Error('Unexpected import: ' + name);
    }, module, module.exports,
  );
  return module.exports;
}
const token = exp => 'header.' + Buffer.from(JSON.stringify({ exp })).toString('base64url') + '.signature';
const policy = load('src/services/firebase/appCheckPolicy.ts');

test('Play Integrity is the default; debug requires explicit development opt-in', () => {
  assert.equal(policy.androidAttestationProvider(false, false), 'playIntegrity');
  assert.equal(policy.androidAttestationProvider(true, false), 'playIntegrity');
  assert.equal(policy.androidAttestationProvider(true, true), 'debug');
  assert.throws(() => policy.androidAttestationProvider(false, true));
});
test('JS caching uses real native JWT expiry and rejects missing, invalid or expired tokens', () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  assert.equal(policy.nativeTokenForJS(token(exp)).expireTimeMillis, exp * 1000);
  for (const value of ['', 'invalid', token('999999999999'), token(null), token(1)]) {
    assert.throws(() => policy.nativeTokenForJS(value));
  }
});

function fixture({ development = false, debug = false, projectId = 'extrack-test', unavailable = false } = {}) {
  const app = { name: '[DEFAULT]', options: { projectId: 'extrack-test', messagingSenderId: '123' } };
  let attempts = 0, configuration, jsOptions, fail = unavailable, forceRefresh;
  const instance = { app };
  const bridge = load('src/services/firebase/workerAppCheck.android.ts', {
    './client': { app },
    'firebase/app-check': {
      CustomProvider: class { constructor(options) { this.getToken = options.getToken; } },
      initializeAppCheck(received, options) { assert.equal(received, app); jsOptions = options; return instance; },
    },
    '@react-native-firebase/app': { getApp: () => ({ options: { ...app.options, projectId, appId: '1:123:android:test' } }) },
    '@react-native-firebase/app-check': {
      ReactNativeFirebaseAppCheckProvider: class { configure(options) { configuration = options; } },
      initializeAppCheck(_app, options) { assert.equal(options.isTokenAutoRefreshEnabled, false); return {}; },
      async getToken(_instance, force) {
        attempts++; forceRefresh = force;
        if (fail) throw Error('private native diagnostic');
        return { token: token(Math.floor(Date.now() / 1000) + 3600) };
      },
    },
  }, { __DEV__: development, process: { env: { EXPO_PUBLIC_ANDROID_APP_CHECK_DEBUG_ENABLED: String(debug) } } });
  return { bridge, instance, get attempts() { return attempts; }, get configuration() { return configuration; },
    get options() { return jsOptions; }, get forceRefresh() { return forceRefresh; }, recover() { fail = false; } };
}
test('Android initialization is shared; JS CustomProvider refreshes native tokens without a second auth app', async () => {
  const f = fixture();
  const [first, second] = await Promise.all([f.bridge.initializeWorkerAppCheck(), f.bridge.initializeWorkerAppCheck()]);
  assert.equal(first, second); assert.equal(first, f.instance); assert.equal(f.attempts, 1);
  assert.equal(f.configuration.android.provider, 'playIntegrity');
  assert.equal(f.options.isTokenAutoRefreshEnabled, true);
  await f.options.provider.getToken(); assert.equal(f.attempts, 1);
  await f.options.provider.getToken(); assert.equal(f.attempts, 2); assert.equal(f.forceRefresh, true);
});
test('Explicit development debug provider never receives a bundled secret', async () => {
  const f = fixture({ development: true, debug: true });
  await f.bridge.initializeWorkerAppCheck();
  assert.equal(f.configuration.android.provider, 'debug');
  assert.equal('debugToken' in f.configuration.android, false);
});
test('Wrong Firebase project and release debug mode fail before attestation', async () => {
  for (const f of [fixture({ projectId: 'other' }), fixture({ debug: true })]) {
    await assert.rejects(f.bridge.initializeWorkerAppCheck(), /Device attestation unavailable/);
    assert.equal(f.attempts, 0); assert.equal(f.options, undefined);
  }
});
test('Unavailable attestation fails closed, sanitizes errors, and allows a later retry', async () => {
  const f = fixture({ unavailable: true });
  await assert.rejects(f.bridge.initializeWorkerAppCheck(), /Device attestation unavailable/);
  assert.equal(f.options, undefined);
  f.recover(); await f.bridge.initializeWorkerAppCheck(); assert.equal(f.attempts, 2);
  await f.options.provider.getToken();
});
test('Other platforms remain explicitly unavailable', async () => {
  await assert.rejects(load('src/services/firebase/workerAppCheck.ts').initializeWorkerAppCheck(), /not configured/);
});
