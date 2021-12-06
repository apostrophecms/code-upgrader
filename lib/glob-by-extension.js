const glob = require('glob');

module.exports = (extension) => {
  return glob.sync(`**/*.${extension}`, {
    ignore: [
      'dist/**/*',
      '**/node_modules/**',
      '**/public/**/*',
      '**/private/**/*',
      'apos-build/**/*'
    ]
  });
};
