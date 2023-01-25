const glob = require('glob');
const ignore = [
  'dist/**/*',
  '**/node_modules/**',
  '**/public/**/*',
  '**/private/**/*',
  'apos-build/**/*'
];

module.exports = (extension, pattern) => {
  if (!pattern) {
    return glob.sync(`**/*.${extension}`, { ignore });

  } else {
    const res = glob.sync(pattern, { ignore });
    console.log('res:', res);
    return res;
  }
};

module.exports = {
  globByExtension (extension) {
    return glob.sync(`**/*.${extension}`, { ignore });
  },
  globByPattern (pattern) {
    return glob.sync(pattern, { ignore });
  }

};
