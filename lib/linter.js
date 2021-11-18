const glob = require('glob');
const linters = require('./linters.js');
const fs = require('fs');

module.exports = () => {
  const files = glob.sync('**/*.js', { ignore: "**/node_modules/**" });
  let matched = false;
  files.forEach(lint);

  function lint(file) {
    const src = fs.readFileSync(file, { encoding: 'utf8' });
    for (const [ name, options ] of Object.entries(linters)) {
      const matches = src.matchAll(options.match);
      for (const match of matches) {
        const line = indexToLine(src, match.index);
        console.error(line.text);
        console.error(' '.repeat(line.columnNumber - 1) + '^\n');
        console.error(`${file}, line ${line.lineNumber}: ${options.message}\n`);
        if (options.url) {
          console.error(`See: ${options.url}\n`);
        }
        matched = true;
      }
    }
  }

  function indexToLine(src, index) {
    let text = '';
    let lineNumber = 1;
    let columnNumber = 1;
    let i = 0;
    let found = false;
    for (i = 0; (i < src.length); i++) {
      if (i === index) {
        found = true;
      }
      const char = src.charAt(i);
      if (char === '\n') {
        if (found) {
          break;
        }
        lineNumber++;
        columnNumber = 1;
        text = '';
      } else {
        if (!found) {
          columnNumber++;
        }
        text += char;
      }
    }
    if (found) {
      return {
        text,
        lineNumber,
        columnNumber
      }
    } else {
      throw new Error('Could not find index in string');
    }
  }
};

