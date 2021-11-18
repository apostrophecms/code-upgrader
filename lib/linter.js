const glob = require('glob');
const linters = require('./linters.js');

module.exports = () => {
  const files = glob.sync('**/*.js', { ignore: "**/node_modules/**" });
  console.log(files);
}
