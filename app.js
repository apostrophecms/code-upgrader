const argv = require('boring')();
const cp = require('child_process');
const linter = require('./lib/linter');
const converter = require('./lib/converter');

if (argv._[0] === 'reset') {
  cp.execSync('git reset --hard && git clean -df');
} else if (argv._[0] === 'lint') {
  linter();
} else if (argv._[0] === 'convert') {
  converter();
} else {
  // help goes here
  console.log('halp');
}
