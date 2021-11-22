const argv = require('boring')();
const cp = require('child_process');
const linter = require('./lib/linter');
const upgrader = require('./lib/upgrader');
const { stripIndent } = require('common-tags');

if (argv._[0] === 'reset') {
  cp.execSync('git reset --hard && git clean -df');
} else if (argv._[0] === 'lint') {
  linter({ argv });
} else if (argv._[0] === 'upgrade') {
  upgrader({ argv });
} else {
  console.log(stripIndent`
    Usage:

    # List changes you need to make (always recommended)
    apos-code-upgrader lint

    # Make some changes automatically (does not do everything)
    apos-code-upgrader upgrade
  `);
}
