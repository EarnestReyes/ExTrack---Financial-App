module.exports = {
  root: true,
  parser: require.resolve('@typescript-eslint/parser', { paths: [require('path').resolve(__dirname, '../../functions')] }),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  env: { es2022: true, browser: true },
  rules: { 'no-debugger': 'error', 'no-eval': 'error', 'no-implied-eval': 'error', 'no-unreachable': 'error', 'no-constant-condition': 'error', 'eqeqeq': 'error', 'no-var': 'error' }
};
