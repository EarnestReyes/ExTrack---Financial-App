// Static-only checks. No Firebase initialization, device database or build output.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const baseline = require('../tests/architecture-baseline.json');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const normalize = (value) => value.replace(/^export\s+/, '').replace(/\s+/g, ' ');
const filesIn = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesIn(dir + '/' + entry.name) : [dir + '/' + entry.name]);
const files = [...filesIn('src'), ...filesIn('functions/src')].filter((file) => /\.tsx?$/.test(file));
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
const graph = new Map();
const declarations = new Map();
const trees = new Map();

for (const [file, expected] of Object.entries(baseline.unchanged)) {
  assert.equal(hash(fs.readFileSync(path.join(root, file))), expected, `${file} changed during a structural refactor`);
}
for (const file of files) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  trees.set(file, tree);
  const edges = new Set();
  graph.set(path.join(root, file), edges);
  for (const node of tree.statements) {
    const name = node.name?.text || (ts.isVariableStatement(node) ? node.declarationList.declarations[0].name.getText(tree) : null);
    if (name) {
      const group = file.startsWith('src/database/') ? 'database' : file.startsWith('functions/src/api/') ? 'functions' : '';
      declarations.set(`${group}:${name}`, node.getText(tree));
    }
  }
  function visit(node) {
    if (ts.isStringLiteral(node)) {
      const parent = node.parent;
      const module = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node;
      const require = ts.isCallExpression(parent) && parent.arguments[0] === node && (parent.expression.getText(tree) === 'require' || parent.expression.kind === ts.SyntaxKind.ImportKeyword);
      if ((module || require) && (node.text.startsWith('.') || node.text.startsWith('@/'))) {
        const resolved = ts.resolveModuleName(node.text, path.join(root, file), options, ts.sys).resolvedModule;
        const raw = node.text.startsWith('@/assets/') ? path.join(root, 'assets', node.text.slice(9)) : node.text.startsWith('@/') ? path.join(root, 'src', node.text.slice(2)) : path.resolve(root, path.dirname(file), node.text);
        assert.ok(resolved || fs.existsSync(raw), `${file}: unresolved import/asset ${node.text}`);
        if (resolved && resolved.resolvedFileName.startsWith(root + path.sep) && !resolved.resolvedFileName.includes('node_modules')) edges.add(path.normalize(resolved.resolvedFileName));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}

const visiting = new Set(), visited = new Set();
function checkCycles(file, chain = []) {
  assert.ok(!visiting.has(file), `Import cycle: ${[...chain, file].map((item) => path.relative(root, item)).join(' -> ')}`);
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of graph.get(file) || []) checkCycles(dependency, [...chain, file]);
  visiting.delete(file); visited.add(file);
}
for (const file of graph.keys()) checkCycles(file);

for (const expected of baseline.databaseDeclarations) {
  assert.equal(hash(normalize(declarations.get('database:' + expected.name) || '')), expected.hash, `Database declaration changed: ${expected.name}`);
}
for (const expected of baseline.functionDeclarations) {
  assert.equal(hash((declarations.get('functions:' + expected.name) || '').replace(/\s+/g, ' ')), expected.hash, `Function handler changed: ${expected.name}`);
}
const schema = trees.get('src/database/schema.ts');
const initialize = schema.statements.find((node) => ts.isFunctionDeclaration(node) && node.name.text === 'initializeOwnedDatabase');
// The captured source slice includes the original leading/trailing indentation.
assert.equal(hash(' ' + initialize.body.statements.map((node) => node.getText(schema)).join('\n').replace(/\s+/g, ' ') + ' '), baseline.schemaHash, 'Schema initialization changed');
assert.ok(read('src/database/connection.ts').includes('extrack-owned-v1-${fileId}.db'));
assert.ok(read('src/database/repositories/settingsRepository.ts').includes('extrack-preferences-v1.db'));

assert.deepEqual(filesIn('src/app').filter((file) => /\.tsx?$/.test(file)).sort(), [...baseline.routes, 'src/app/(tabs)/activity.tsx', 'src/app/(tabs)/insights.tsx'].sort(), 'Unexpected route paths changed');
for (const route of [...baseline.routes, 'src/app/(tabs)/activity.tsx', 'src/app/(tabs)/insights.tsx'].filter((file) => !file.endsWith('_layout.tsx'))) {
  const statements = trees.get(route).statements;
  assert.equal(statements.length, 1, `${route} must remain a thin route entry point`);
  assert.ok(ts.isExportDeclaration(statements[0]), `${route} must re-export its implementation`);
}
assert.ok(fs.existsSync(path.join(root, 'src/components/layout/app-tabs.tsx')));
assert.ok(fs.existsSync(path.join(root, 'src/components/layout/app-tabs.web.tsx')));
console.log(`Architecture checks passed: ${files.length} modules; imports/assets resolve; no local cycles; route paths, database declarations, schema, backend handlers and protected configuration preserved.`);
