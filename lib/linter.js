const fs = require('fs');
const acorn = require('acorn');
const glob = require('glob');
const stripIndents = require('common-tags').stripIndents;

const linters = require('./linters.js');
const get = require('./get.js');
const { globByExtension } = require('./glob-by-extension.js');

module.exports = ({ argv }) => {
  lintWebpack();
  const extensions = Object.keys(linters);
  let matched = false;
  for (const extension of extensions) {
    if (extension === 'module') {
      lintModules();
    } else {
      const files = globByExtension(extension);
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
          if (matchRule(moduleName(module), options.matchName).length) {
            report(module, name, options);
          }
        } else if (options.matchFilename) {
          if (matchRule(module, options.matchFilename).length) {
            report(module, name, options);
          }
        }
      }
    }
    function report(module, name, options) {
      matchedModuleRule[name] = true;
      console.error(`${module}:\n`);
      console.error(getMessage({
        name: moduleName(module),
        filename: module
      }, options.message));
      console.error();
    }
  }

  function lint(extension, file) {
    const src = fs.readFileSync(file, { encoding: 'utf8' });
    let parsed;

    const results = [];

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
        matches = matchRule(src, options.match);
      }
      for (const match of matches) {
        // Don't mess up if index is 0
        const line = indexToLine(src, (match.index !== undefined) ? match.index : match.start);
        results.push({
          lineNumber: line.lineNumber,
          // stripIndent just doesn't work here and I don't know why
          error: `
${file}, line ${line.lineNumber}:

${line.text}
${' '.repeat(line.columnNumber - 1) + '^'}
${getMessage({
  src,
  line,
  match
}, options.message)}
${options.url ? `\nSee: ${options.url}\n` : ''}
          `.trim()
        });
        matched = true;
      }
    }

    results.sort((a, b) => {
      if (a.lineNumber < b.lineNumber) {
        return -1;
      } else if (a.lineNumber > b.lineNumber) {
        return 1;
      } else {
        return 0;
      }
    });

    for (const result of results) {
      console.error(result.error + '\n');
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
    return path.substring(path.lastIndexOf('@'), path.length);
  } else if (path.includes('/')) {
    return path.substring(path.lastIndexOf('/') + 1, path.length);
  } else {
    // Standalone module, we were passed the module name
    return path;
  }
}

function matchRule(s, rule) {
  if ((typeof rule) === 'function') {
    const result = rule(s);
    return result ? [ result ] : [];
  } else if (rule.global) {
    return [ ...s.matchAll(rule) ];
  } else {
    const result = s.match(rule);
    return result ? [ result ] : [];
  }
}

function getMessage(input, message) {
  const formatted = ((typeof message) === 'function') ? message(input) : message;
  return formatted.trim();
}

function lintWebpack() {
  if (fs.existsSync('./webpack.config.js')) {
    console.error(stripIndents`
      This project contains a webpack.config.js file. Depending on your needs
      this might not be necessary with A3.

      See:
      
      https://v3.docs.apostrophecms.org/guide/front-end-assets.html
    `);
  }
}
