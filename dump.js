const moduleName = process.argv[2];
const code = require('fs').readFileSync(moduleName, 'utf8');
const esprima = require('esprima');
const escodegen = require('escodegen');
const parsed = esprima.parseScript(code);
console.log(JSON.stringify(parsed, null, '  '));
