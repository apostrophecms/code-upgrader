const moduleName = process.argv[2];
const code = require('fs').readFileSync(moduleName, 'utf8');
const acorn = require('acorn');
const escodegen = require('escodegen');
const parsed = acorn.parse(code);
console.log(JSON.stringify(parsed, null, '  '));
