module.exports = () => {
  return glob.sync(`**/*.${extension}`, {
    ignore: [
      'dist/**/*',
      '**/node_modules/**',
      '**/public/**/*',
      '**/private/**/*'
    ]
  });
};
