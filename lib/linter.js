const glob = require('glob');
const fs = require('fs');
const acorn = require('acorn');

const linters = require('./linters.js');
const get = require('./get.js');

module.exports = () => {
  const extensions = Object.keys(linters);
  let matched = false;
  for (const extension of extensions) {
    if (extension === 'module') {
      lintModules();
    } else {
      const files = glob.sync(`**/*.${extension}`, { ignore: [ 'dist/**/*', '**/node_modules/**', '**/public/**/*', '**/private/**/*' ] });
      files.forEach(file => lint(extension, file));
    }
  }
  if (matched) {
    process.exit(1);
  }

  function lintModules() {
    const matchedModuleRule = {};
    const modules = [ ...glob.sync('lib/modules/*'), ...glob.sync('lib/modules/@*/*'), ...glob.sync('modules/*'), ...glob.sync('modules/@*/*') ].filter(path => fs.lstatSync(path).isDirectory());
    modules.forEach(module => lintModule(module));
    function lintModule(module) {
      for (const [ name, options ] of Object.entries(linters.module)) {
        if (options.once && matchedModuleRule[name]) {
          continue;
        }
        if (options.matchName) {
          if (moduleName(module).match(options.matchName)) {
            report(module, name, options);
          }
        } else if (options.matchFilename) {
          if (module.match(options.matchFilename)) {
            report(module, name, options);
          }
        }
      }
    }
    function report(module, name, options) {
      matchedModuleRule[name] = true;
      console.error(`${module}:`);
      console.error(options.message.trim());
      console.error();
    }
  }

  function lint(extension, file) {
    const src = fs.readFileSync(file, { encoding: 'utf8' });
    let parsed;

    if (file.match(/\.js$/)) {
      let ast;
      try {
        ast = acorn.parse(src, {
          locations: true,
          ranges: true,
          ecmaVersion: 2020
        });
      } catch (e) {
        console.error(`Could not parse ${file}, some linter tests will not be available.`);
      }

      const exportsStatement = ast && ast.body.find(statement => {
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

    for (const options of Object.values(linters[extension])) {
      let matches = [];
      if (options.matchParsed && parsed.ast) {
        matches = options.matchParsed(parsed);
        if (matches) {
          if (!Array.isArray(matches)) {
            matches = [ matches ];
          }
        } else {
          matches = [];
        }
      } else if (options.match) {
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
      };
    } else {
      throw new Error('Could not find index in string');
    }
  }
};

function moduleName(path) {
  if (path.includes('@')) {
    return path.substring(path.indexOf('@'), path.length);
  } else if (path.includes('/')) {
    return path.substring(path.indexOf('/'), path.length);
  } else {
    // Standalone module, we were passed the module name
    return path;
  }
}