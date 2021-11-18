const glob = require('glob');
const fs = require('fs');
const acorn = require('acorn');

const linters = require('./linters.js');
const get = require('./get.js');

module.exports = () => {
  const extensions = Object.keys(linters);
  let matched = false;
  for (extension of extensions) {
    const files = glob.sync(`**/*.${extension}`, { ignore: "**/node_modules/**" });
    files.forEach(file => lint(extension, file));
  }
  if (matched) {
    process.exit(1);
  }

  function lint(extension, file) {
    const src = fs.readFileSync(file, { encoding: 'utf8' });
    let parsed;

    if (file.match(/\.js$/)) {
      const ast = acorn.parse(src, {
        locations: true,
        ranges: true,
        ecmaVersion: 2020
      });

      const exportsStatement = ast.body.find(statement => {
        return (get(statement, 'expression.left.object.name') === 'module') &&
          (get(statement, 'expression.left.property.name') === 'exports');
      });
      parsed = {
        ast,
        exports: {}
      };
      if (exportsStatement) {
        const moduleBody = get(exportsStatement, 'expression.right');
        if (get(moduleBody, 'type') === 'ObjectExpression') {
          get(moduleBody, 'properties').forEach(property => {
            const name = get(property, 'key.name');
            const value = get(property, 'value');
            parsed.exports[name] = value;
          });
        }
      }
    }

    for (const [ name, options ] of Object.entries(linters[extension])) {
      let matches;
      if (options.matchParsed) {
        matches = options.matchParsed(parsed);
        if (matches) {
          if (!Array.isArray(matches)) {
            matches = [ matches ];
          }
        } else {
          matches = [];
        }
      } else {
        matches = src.matchAll(options.match);
      }
      for (const match of matches) {
        const line = indexToLine(src, match.index || match.start);
        console.error(`${file}, line ${line.lineNumber}:\n`);
        console.error(line.text);
        console.error(' '.repeat(line.columnNumber - 1) + '^');
        console.log(options.message.trim() + '\n');
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

