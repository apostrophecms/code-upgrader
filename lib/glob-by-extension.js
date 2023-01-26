const glob = require('glob');
const ignore = [
  'dist/**/*',
  '**/node_modules/**',
  '**/public/**/*',
  '**/private/**/*',
  'apos-build/**/*'
];

module.exports = {
  globByExtension (extension) {
    return glob.sync(`**/*.${extension}`, { ignore });
  },
  globByPattern (pattern) {
    return glob.sync(pattern, { ignore });
  }
};
