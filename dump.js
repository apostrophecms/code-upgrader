const moduleName = process.argv[2];
const code = require('fs').readFileSync(moduleName, 'utf8');
const acorn = require('acorn');
const parsed = acorn.parse(code);

console.info(JSON.stringify(parsed, null, '  '));
