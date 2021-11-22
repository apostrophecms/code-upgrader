const argv = require('boring')();
const cp = require('child_process');
const linter = require('./lib/linter');
const upgrader = require('./lib/upgrader');

if (argv._[0] === 'reset') {
  cp.execSync('git reset --hard && git clean -df');
} else if (argv._[0] === 'lint') {
  linter({ argv });
} else if (argv._[0] === 'upgrade') {
  upgrader({ argv });
} else {
  // help goes here
  console.log('halp');
}
