const argv = require('boring')();
const cp = require('child_process');
const linter = require('./lib/linter');
const upgrader = require('./lib/upgrader');
const { stripIndent } = require('common-tags');
const prompts = require('prompts');

if (argv._[0] === 'reset') {
  cp.execSync('git reset --hard && git clean -df');
} else if (argv._[0] === 'lint') {
  linter({ argv });
} else if (argv._[0] === 'upgrade') {
  confirm()
    .then(response => {
      if (response && response.proceed) {
        upgrader({ argv });
      }
    })
    .catch(err => {
      console.error(err);
    });
} else if (argv._[0] === 'help' || argv.help) {
  console.log(stripIndent`
    Commands:

      lint                  List changes you need to make (always recommended)
        Example: apos-code-upgrader lint
      upgrade [options]     Make some changes automatically
        Example: apos-code-upgrader upgrade
        Options:
        - --upgrade-required-files: Experimental support for inlining module
          code included with \`require\` statements. Most successful when the
          inlined file is limited to an exported function that the module
          invokes with \`(self, options)\`
  `);
} else {
  console.log(stripIndent`
    Run \`apos-code-upgrader help\` or \`apos-code-upgrader --help\` for commands.
`);
}

async function confirm() {
  return prompts({
    type: 'confirm',
    name: 'proceed',
    message: stripIndent`
      Running the upgrade command will make MAJOR changes to your code. It will not (git) commit those changes, however.

      Are you sure you want to continue?`,
    initial: false
  });
}
