const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const escodegen = require('escodegen');
const cp = require('child_process');
const { stripIndent } = require('common-tags');
const fail = require('./fail.js');
const get = require('./get.js');
const legacyModuleNameMap = require('./legacy-module-name-map.js');

// This is a random identifier not used anywhere else
const blankLineMarker = '// X0k7FEu5a6!bC6mV';
const renamedModulesMap = {};

module.exports = (options) => {

  try {
    cp.execSync('git status', { encoding: 'utf8' });
  } catch (e) {
    fail(stripIndent`
      This project does not appear to be using git. For your protection and to simplify
      certain operations this tool can only be used in a git repository.
    `);
  }

  if (isSingleSiteProject()) {
    // Only touch directories, don't mess about with regular files in lib/modules (WTF)
    // or symlinks in lib/modules (double WTF, but outside our remit)
    let moduleNames = fs.readdirSync('lib/modules').filter(moduleName => fs.lstatSync(`lib/modules/${moduleName}`).isDirectory());
    moduleNames.forEach(name => {
      rename(`lib/modules/${name}`, `modules/${name}`);
    });
    try {
      fs.rmdirSync('lib/modules');
    } catch (e) {
      if (e.code === 'ENOTEMPTY') {
        console.error(stripIndent`
          "lib/modules" is not empty after moving modules to "modules". You probably
          have files that are not apostrophe modules in that folder. Please
          move those files to a more appropriate location, like lib, then
          remove "lib/modules" yourself.
        `);
      } else {
        throw e;
      }
    }
    moduleNames = fs.readdirSync('modules');
    moduleNames.forEach(moduleName => {
      processModuleInFolder('modules', moduleName);
    });
  } else if (isSingleNpmModule()) {
    processStandaloneModule();
  } else if (isMoogBundle()) {
    throw new Error('TODO: implement moog bundle migration');
  } else {
    fail(stripIndent`
      The current directory does not look like a single-site apostrophe project,
      an Apostrophe module packaged as an npm module, or a bundle of Apostrophe modules
      packaged as an npm module. Not sure what to do.
    `);
  }

  console.log(stripIndent`
    The upgrade task is complete, but it is certain that you will need
    to make additional adjustments and changes.

    It is recommended that you run "apos-code-upgrader lint" next to view
    additional code upgrade concerns requiring manual attention.
  `);

  function processModuleInFolder(folder, moduleName) {
    moduleName = renamedModulesMap[moduleName] || moduleName;
    let moduleFilename = `${folder}/${moduleName}/index.js`;
    if (!fs.existsSync(moduleFilename)) {
      // Not all project level modules have an index.js file, but
      // always create at least a minimal index.js file to
      // avoid problems if anything must be hoisted there
      // from a template, etc.
      fs.writeFileSync(moduleFilename, 'module.exports = {};\n');
    }
    const newModuleName = filterModuleName(moduleName);
    if (newModuleName !== moduleName) {
      moduleFilename = renameModule(moduleName, newModuleName);
    }
    return processModule(moduleName, moduleFilename, { renameModule });

    function renameModule(moduleName, newModuleName) {
      const newModuleFilename = moduleFilename.replace(`${moduleName}/index.js`, `${newModuleName}/index.js`);
      // Rename the module folder, the index.js part doesn't change
      rename(path.dirname(moduleFilename), path.dirname(newModuleFilename));
      renamedModulesMap[moduleName] = newModuleName;
      return newModuleFilename;
    }
  }

  function processStandaloneModule() {
    const packageInfo = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    let main = packageInfo.main || 'index.js';
    if (!main.endsWith('.js')) {
      main += '.js';
    }
    const moduleName = packageInfo.name;
    processModule(moduleName, main, {
      renameModule(moduleName, newModuleName) {
        if (packageInfo.name.includes('@')) {
          packageInfo.name = packageInfo.name.replace(`/${moduleName}`, newModuleName);
        } else {
          packageInfo.name = newModuleName;
        }
        console.error(`This repository should be renamed ${newModuleName}`);
        return main;
      }
    });
  }

  function processModule(moduleName, moduleFilename, { renameModule }) {

    const code = protectBlankLines(require('fs').readFileSync(moduleFilename, 'utf8'));
    let helpers;
    const comments = [];
    const tokens = [];
    let parsed = acorn.parse(code, {
      ranges: true,
      locations: true,
      onComment: comments,
      onToken: tokens,
      ecmaVersion: 2020
    });
    parsed = escodegen.attachComments(parsed, comments, tokens);
    const prologue = [];
    let methods = [];
    const earlyInits = [];
    let lateInits = [];
    let adjusts = [];
    let helpersNeeded = false;
    const options = [];
    const newModuleBodyProperties = [];
    const routes = {};
    const superCaptures = {};
    const moveMethodsToHandlers = [];
    const specials = {
      extend: true,
      improve: true,
      // A "special" because it already works exactly the
      // way we want it to in 2.x, i.e. leave it alone please
      customTags: true,
      moogBundle: 'bundle'
    };
    const importedPaths = [];

    const specialsFound = {};

    let moduleBody;
    const handlers = {};

    parsed.body.forEach(statement => {
      if (
        (get(statement, 'expression.left.object.name') === 'module') &&
        (get(statement, 'expression.left.property.name') === 'exports')
      ) {
        const right = get(statement, 'expression.right');
        if (get(right, 'type') !== 'ObjectExpression') {
          return null;
        }
        moduleBody = right;
        get(right, 'properties').forEach(property => {
          const name = get(property, 'key.name');
          if (name === 'construct') {
            const value = get(property, 'value.body');
            if (get(value, 'type') === 'BlockStatement') {
              parseConstruct(parsed, value.body);
            }
          } else if (name === 'beforeConstruct') {
            const value = get(property, 'value.body');
            if (get(value, 'type') === 'BlockStatement') {
              parseBeforeConstruct(value.body);
            }
          } else if (name === 'afterConstruct') {
            const value = get(property, 'value.body');
            if (get(value, 'type') === 'BlockStatement') {
              parseAfterConstruct(value.body);
            }
          } else if (specials[name]) {
            const special = (specials[name] === true) ? name : specials[name];
            specialsFound[special] = get(property, 'value');
          } else if (name === 'addFields') {
            handleFieldsOption('add', get(property, 'value'));
          } else if (name === 'arrangeFields') {
            handleFieldsOption('group', get(property, 'value'));
          } else if (name === 'removeFields') {
            const value = get(property, 'value');
            // Not like the others
            const fields = ensureFields();
            const remove = {
              type: 'Property',
              key: {
                type: 'Identifier',
                name: 'remove'
              },
              value
            };
            fields.value.properties.push(remove);
          } else {
            options[name] = get(property, 'value');
          }
        });
      }
    });

    // TODO also support detection of modules that extend a subclass of pieces,
    // but this is nontrivial and relatively uncommon in projects being migrated
    if (specialsFound.extend?.value === 'apostrophe-pieces') {
      if (options.name.value && (options.name.value !== moduleName)) {
        moduleFilename = renameModule(moduleName, options.name.value);
        moduleName = options.name.value;
      }
    }

    if (!moduleBody) {
      console.error(`⚠️ The module ${moduleName} has no module.export statement, ignoring it`);
      return;
    }

    parsed.body = prologue.concat(parsed.body);

    moduleBody.properties = [];

    Object.keys(specialsFound).forEach(special => {
      moduleBody.properties.push({
        type: 'Property',
        key: {
          type: 'Identifier',
          name: special
        },
        value: specialsFound[special]
      });
    });

    if (Object.keys(options).length) {
      moduleBody.properties.push({
        type: 'Property',
        key: {
          type: 'Identifier',
          name: 'options'
        },
        value: {
          type: 'ObjectExpression',
          properties: Object.keys(options).map(key => ({
            type: 'Property',
            key: {
              type: 'Identifier',
              name: key
            },
            value: options[key]
          }))
        }
      });
    }

    let inits = earlyInits.concat(lateInits);

    inits = inits.filter(function(init) {
      if (route('apiRoute', init)) {
        return false;
      } else if (route('renderRoute', init)) {
        return false;
      } else if (route('htmlRoute', init)) {
        return false;
      } else if (route('route', init)) {
        return false;
      } else if (addHelpers(init)) {
        return false;
      } else if (onEvent(init)) {
        return false;
      } else if (superCapture(init)) {
        return false;
      } else {
        return true;
      }
    });

    if (adjusts.length) {
      moduleBody.properties.push({
        type: 'Property',
        key: {
          type: 'Identifier',
          name: 'beforeSuperClass'
        },
        value: {
          type: 'FunctionExpression',
          params: [
            {
              type: 'Identifier',
              name: 'self'
            },
            {
              type: 'Identifier',
              name: 'options'
            }
          ],
          body: {
            type: 'BlockStatement',
            body: adjusts
          }
        },
        method: true
      });
    }

    if (inits.length) {
      moduleBody.properties.push({
        type: 'Property',
        key: {
          type: 'Identifier',
          name: 'init'
        },
        value: {
          type: 'FunctionExpression',
          params: [
            {
              type: 'Identifier',
              name: 'self'
            },
            {
              type: 'Identifier',
              name: 'options'
            }
          ],
          body: {
            type: 'BlockStatement',
            body: inits
          }
        },
        method: true,
        async: true
      });
    }

    Object.keys(routes).forEach(type => {
      moduleBody.properties.push({
        type: 'Property',
        key: {
          type: 'Identifier',
          name: type + 's'
        },
        value: {
          type: 'FunctionExpression',
          params: [
            {
              type: 'Identifier',
              name: 'self'
            },
            {
              type: 'Identifier',
              name: 'options'
            }
          ],
          body: {
            type: 'BlockStatement',
            body: [
              {
                type: 'ReturnStatement',
                argument: {
                  type: 'ObjectExpression',
                  properties: Object.keys(routes[type]).map(httpMethod => {
                    return {
                      type: 'Property',
                      key: {
                        type: 'Identifier',
                        name: httpMethod
                      },
                      value: {
                        type: 'ObjectExpression',
                        properties: Object.keys(routes[type][httpMethod]).map(name => {
                          const fns = routes[type][httpMethod][name];
                          return {
                            type: 'Property',
                            key: {
                              type: 'Identifier',
                              name: name
                            },
                            leadingComments: fns[0].comments,
                            value: middlewareAndRouteFunction(fns),
                            method: (fns.length === 1)
                          };
                        })
                      }
                    };
                  })
                }
              }
            ]
          }
        },
        method: true
      });

    });

    for (const item of moveMethodsToHandlers) {
      const method = methods.find(method => method.name === item[1]);
      handlers[item[0]][item[1]] = method.statement.expression.right;
      // handlers[item[0]][item[1]].comments = method.comments;
      // console.log(handlers[item[0]][item[1]].comments );
      methods = methods.filter(method => method.name !== item[1]);
    }

    const extendMethods = methods.filter(method => superCaptures[method.name]);
    methods = methods.filter(method => !superCaptures[method.name]);

    if (Object.keys(handlers).length) {
      moduleBody.properties.push({
        type: 'Property',
        key: {
          type: 'Identifier',
          name: 'handlers'
        },
        value: {
          type: 'FunctionExpression',
          params: [
            {
              type: 'Identifier',
              name: 'self'
            },
            {
              type: 'Identifier',
              name: 'options'
            }
          ],
          body: {
            type: 'BlockStatement',
            body: [
              {
                type: 'ReturnStatement',
                argument: {
                  type: 'ObjectExpression',
                  properties: Object.keys(handlers).map(eventName => {
                    return {
                      type: 'Property',
                      key: {
                        type: 'Literal',
                        value: eventName
                      },
                      value: {
                        type: 'ObjectExpression',
                        properties: Object.keys(handlers[eventName]).map(name => ({
                          type: 'Property',
                          key: {
                            type: 'Identifier',
                            name: name
                          },
                          value: handlers[eventName][name],
                          // leadingComments: handlers[eventName][name].comments,
                          method: true
                        }))
                      }
                    };
                  })
                }
              }
            ]
          }
        },
        method: true
      });
    }

    moduleBody.properties = [ ...moduleBody.properties, ...newModuleBodyProperties ];

    outputMethods('methods', methods);
    outputMethods('extendMethods', extendMethods);
    outputHelpers(helpers);

    const required = {};

    if (options['upgrade-required-files']) {
      parsed.body = parsed.body.filter(expression => {
        if (expression.type !== 'VariableDeclaration') {
          return true;
        }
        const declaration = expression && expression.declarations && expression.declarations[0];
        if (!declaration) {
          return true;
        }
        if (declaration.type !== 'VariableDeclarator') {
          return true;
        }
        if (get(declaration, 'init.type') !== 'CallExpression') {
          return true;
        }
        if (get(declaration, 'init.callee.name') !== 'require') {
          return true;
        }
        let varName;
        if (get(declaration, 'id.type') === 'ObjectPattern') {
          // const { foo, bar } = require('baz')
          varName = get(declaration, 'id.properties').map(property => get(property, 'key.name')).join(':');
        } else {
          // const bar = require('baz')
          varName = get(declaration, 'id.name');
        }
        const args = get(declaration, 'init.arguments');
        const arg = args && (args.length === 1) && args[0];
        if (!arg) {
          return true;
        }
        if (required[varName]) {
          // Duplicate stomped
          return false;
        }
        required[varName] = true;
        return true;
      });
    }

    // if we're going to crash, do it before we start overwriting or
    // removing any files

    const generated = restoreBlankLines(escodegen.generate(parsed, {
      format: {
        indent: {
          style: '  ',
          base: 0,
          adjustMultilineComment: false
        },
        newline: '\n',
        space: ' ',
        json: false,
        renumber: false,
        hexadecimal: false,
        quotes: 'single',
        escapeless: false,
        compact: false,
        parentheses: true,
        semicolons: true,
        safeConcatenation: false
      },
      comment: true
    }));

    fs.writeFileSync(moduleFilename, generated);

    importedPaths.map(fs.unlinkSync);

    function parseConstruct(parsed, body) {
      body.forEach(statement => {
        if (statement.type === 'ExpressionStatement') {
          if (statement.expression.type === 'AssignmentExpression') {
            const methodName = get(statement, 'expression.left.property.name');
            const fn = get(statement, 'expression.right');
            if (fn.type === 'FunctionExpression') {
              methods.push({
                name: methodName,
                statement: statement,
                leadingComments: statement.leadingComments
              });
              return;
            }
          } else if (options['upgrade-required-files'] && (statement.expression.type === 'CallExpression') && (get(statement, 'expression.callee.callee.name') === 'require')) {
            const args = get(statement, 'expression.arguments');
            if ((args.length === 2) && (args[0].name === 'self') &&
              (args[1].name === 'options')) {
              const requirePath = get(statement, 'expression.callee.arguments.0.value');
              // recurse into path
              let fsPath = path.resolve(path.dirname(moduleFilename), requirePath);
              if (!fsPath.match(/\.js$/)) {
                fsPath += '.js';
              }
              importedPaths.push(fsPath);
              const code = require('fs').readFileSync(fsPath, 'utf8');
              const comments = [];
              const tokens = [];
              let parsed = acorn.parse(code, {
                locations: true,
                ranges: true,
                onToken: tokens,
                onComment: comments
              });
              parsed = escodegen.attachComments(parsed, comments, tokens);
              parsed.body.forEach(statement => {
                if (
                  (get(statement, 'expression.left.object.name') === 'module') &&
                  (get(statement, 'expression.left.property.name') === 'exports')
                ) {
                  const right = get(statement, 'expression.right');
                  if (get(right, 'type') !== 'FunctionExpression') {
                    return null;
                  }
                  if (right.body && right.body.body) {
                    parseConstruct(parsed, right.body.body);
                  }
                } else {
                  prologue.push(statement);
                }
              });
              return;
            }
          }
        }
        earlyInits.push(statement);
      });
    }

    function parseBeforeConstruct(body) {
      adjusts = body;
    }

    function parseAfterConstruct(body) {
      lateInits = lateInits.concat(body);
    }

    function middlewareAndRouteFunction(fns) {
      if (fns.length === 1) {
        // Methods are not arrow functions
        fns[0].type = 'FunctionExpression';
        return fns[0];
      } else {
        return {
          type: 'ArrayExpression',
          elements: fns
        };
      }
    }

    function camelName(s) {
      // Keep in sync with client side version
      let i;
      let n = '';
      let nextUp = false;
      for (i = 0; (i < s.length); i++) {
        const c = s.charAt(i);
        // If the next character is already uppercase, preserve that, unless
        // it is the first character
        if ((i > 0) && c.match(/[A-Z]/)) {
          nextUp = true;
        }
        if (c.match(/[A-Za-z0-9]/)) {
          if (nextUp) {
            n += c.toUpperCase();
            nextUp = false;
          } else {
            n += c.toLowerCase();
          }
        } else {
          nextUp = true;
        }
      }
      return n;
    };

    // Recursively replace an identifier such as "superOldMethodName" with an
    // identifier such as "_super" throughout "context", even if nested etc.

    function replaceIdentifier(context, oldId, newId) {
      Object.keys(context).forEach(key => {
        const value = context[key];
        if (value && (value.type === 'Identifier') && (value.name === oldId)) {
          value.name = newId;
        }
        if (value && ((typeof value) === 'object')) {
          replaceIdentifier(value, oldId, newId);
        }
      });
    }

    function route(type, init) {
      if ((get(init, 'type') === 'ExpressionStatement') && (get(init, 'expression.type') === 'CallExpression') && (get(init, 'expression.callee.type') === 'MemberExpression') && (get(init, 'expression.callee.object.name') === 'self') && (get(init, 'expression.callee.property.name') === type)) {
        const args = get(init, 'expression.arguments');
        if (!args) {
          return false;
        }
        const method = get(args[0], 'value');
        const name = camelName(get(args[1], 'value'));
        if (!(method && name)) {
          return false;
        }
        const fns = args.slice(2);
        fns[0].leadingComments = init.leadingComments;
        routes[type] = routes[type] || {};
        routes[type][method] = routes[type][method] || {};
        routes[type][method][name] = fns;
        return true;
      } else {
        return false;
      }
    }

    function addHelpers(init) {
      if ((get(init, 'type') === 'ExpressionStatement') && (get(init, 'expression.type') === 'CallExpression') && (get(init, 'expression.callee.object.name') === 'self') && (get(init, 'expression.callee.property.name') === 'enableHelpers')) {
        const enableHelpers = methods.find(method => method.name === 'enableHelpers');
        if (enableHelpers) {
          const body = get(enableHelpers, 'statement.expression.right.body.body.0');
          if (addHelpers(body)) {
            methods = methods.filter(method => method.name !== 'enableHelpers');
            return true;
          }
        }
        return false;
      } else if ((get(init, 'type') === 'ExpressionStatement') && (get(init, 'expression.type') === 'CallExpression') && (get(init, 'expression.callee.object.name') === 'self') && (get(init, 'expression.callee.property.name') === 'addHelpers')) {
        const args = get(init, 'expression.arguments');

        if (args[0].type === 'ObjectExpression') {
          helpers = args[0];
          return true;
        } else if (
          (get(args[0], 'callee.object.name') === '_') &&
          (get(args[0], 'callee.property.name') === 'pick')
        ) {
          helpers = {
            type: 'ArrayExpression',
            elements: args[0].arguments.slice(1)
          };
          return true;
        }
      }
    }

    function onEvent(init) {
      if ((get(init, 'type') === 'ExpressionStatement') && (get(init, 'expression.type') === 'CallExpression') && (get(init, 'expression.callee.object.name') === 'self') && (get(init, 'expression.callee.property.name') === 'on')) {
        const args = get(init, 'expression.arguments');
        if ((args[0].type !== 'Literal') || (args[1].type !== 'Literal')) {
          return false;
        }
        if (!args[2]) {
          const fullEventName = args[0].value;
          const handlerName = args[1].value;
          handlers[fullEventName] = handlers[fullEventName] || {};
          moveMethodsToHandlers.push([ fullEventName, handlerName ]);
          return true;
        } else if ((args[2].type !== 'FunctionExpression') && (args[2].type !== 'ArrowFunctionExpression')) {
          return false;
        }
        args[2].type = 'FunctionExpression';
        const fullEventName = args[0].value;
        const handlerName = args[1].value;
        const handler = args[2];
        handlers[fullEventName] = handlers[fullEventName] || {};
        handlers[fullEventName][handlerName] = handler;
        return true;
      }
    }

    function superCapture(init) {
      if ((get(init, 'type') === 'VariableDeclaration') && get(init, 'declarations.0.id.name') && (get(init, 'declarations.0.id.name').match(/^super/))) {
        superCaptures[get(init, 'declarations.0.init.property.name')] = get(init, 'declarations.0.id.name');
        return true;
      }
    }

    // Thanks, anonymous! https://github.com/estools/escodegen/issues/277#issuecomment-363903537

    function protectBlankLines(code) {
      const lines = code.split('\n');
      const replacedLines = lines.map(line => {
        if (line.length === 0 || /^\s+$/.test(line)) {
          return blankLineMarker;
        }
        return line;
      });
      return replacedLines.join('\n').replace(/\n +\n/g, '\n\n');
    }

    function restoreBlankLines(code) {
      return code.split(blankLineMarker).join('');
    }

    function outputHelpers(helpers) {
      if (!helpers) {
        return;
      }
      if (helpers.type === 'ArrayExpression') {
        moduleBody.properties.push({
          type: 'Property',
          key: {
            type: 'Identifier',
            name: 'helpers'
          },
          value: helpers
        });
      } else {
        moduleBody.properties.push({
          type: 'Property',
          key: {
            type: 'Identifier',
            name: 'helpers'
          },
          value: {
            type: 'FunctionExpression',
            params: [
              {
                type: 'Identifier',
                name: 'self'
              },
              {
                type: 'Identifier',
                name: 'options'
              }
            ],
            body: {
              type: 'BlockStatement',
              body: [
                {
                  type: 'ReturnStatement',
                  argument: helpers
                }
              ]
            }
          },
          method: true
        });
      }
    }

    function outputMethods(category, methods) {
      if (methods.length) {
        moduleBody.properties.push({
          type: 'Property',
          key: {
            type: 'Identifier',
            name: category
          },
          value: {
            type: 'FunctionExpression',
            params: [
              {
                type: 'Identifier',
                name: 'self'
              },
              {
                type: 'Identifier',
                name: 'options'
              }
            ],
            body: {
              type: 'BlockStatement',
              body: [
                {
                  type: 'ReturnStatement',
                  argument: {
                    type: 'ObjectExpression',
                    properties: methods.map(method => {
                      const fn = method.statement.expression.right;
                      if (category === 'extendMethods') {
                        fn.params = fn.params || [];
                        fn.params.unshift({
                          type: 'Identifier',
                          name: '_super'
                        });
                        replaceIdentifier(fn, superCaptures[method.name], '_super');
                      }
                      return {
                        type: 'Property',
                        key: {
                          type: 'Identifier',
                          name: method.name
                        },
                        value: fn,
                        method: true,
                        leadingComments: method.leadingComments
                      };
                    })
                  }
                }
              ]
            }
          },
          method: true
        });
      }
    }

    function ensureFields() {
      let fields = newModuleBodyProperties.find(property =>
        (get(property, 'key.name') === 'fields') &&
        (get(property, 'key.type') === 'Identifier')
      );
      if (!fields) {
        fields = {
          type: 'Property',
          key: {
            type: 'Identifier',
            name: 'fields'
          },
          value: {
            type: 'ObjectExpression',
            properties: []
          }
        };
        newModuleBodyProperties.push(fields);
      }
      return fields;
    }

    function handleFieldsOption(subpropertyName, value) {
      const fields = ensureFields();
      const subproperty = {
        type: 'Property',
        key: {
          type: 'Identifier',
          name: subpropertyName
        },
        value: {
          type: 'ObjectExpression',
          properties: []
        }
      };
      try {
        if (value.type === 'ArrayExpression') {
          for (const element of value.elements) {
            if (element.type === 'ObjectExpression') {
              const name = element.properties.find(property =>
                (get(property, 'key.name') === 'name') &&
                (get(property, 'key.type') === 'Identifier') &&
                (!property.computed));
              const literalOrIdentifier = nameToLiteralOrIdentifier(name);
              const fieldProperty = {
                type: 'Property',
                computed: !literalOrIdentifier,
                key: literalOrIdentifier || name.value,
                value: {
                  type: 'ObjectExpression',
                  properties: element.properties.filter(property => property !== name)
                }
              };
              subproperty.value.properties.push(fieldProperty);
            } else if (element.type === 'SpreadElement') {
              subproperty.value.properties.push({
                type: 'SpreadElement',
                argument: invokeHelper('arrayOptionToObject', element.argument)
              });
            } else {
              throw unsupported();
            }
          }
        } else {
          throw unsupported();
        }
      } catch (e) {
        if (e.name !== 'unsupported') {
          throw e;
        }
        // If there is anything we don't understand at compile time,
        // insert a call to a helper function that can
        // make sense of it at runtime
        subproperty.value = invokeHelper('arrayOptionToObject', value);
      }
      fields.value.properties.push(subproperty);
    }

    // Given a function name and zero or more escodegen expressions as arguments,
    // returns an escodegen expression that invokes the named function
    // with the given arguments
    function invokeHelper(name, ...args) {
      if (!helpersNeeded) {
        helpersNeeded = true;
        prologue.push({
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: {
                type: 'Identifier',
                name: 'aposCodeMigrationHelpers'
              },
              init: {
                type: 'CallExpression',
                callee: {
                  type: 'Identifier',
                  name: 'require'
                },
                arguments: [
                  {
                    type: 'Literal',
                    value: '../../lib/apostrophe-code-migration-helpers.js'
                  }
                ]
              }
            }
          ]
        });
      }
      return {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: {
            type: 'Identifier',
            name: 'aposCodeMigrationHelpers'
          },
          property: {
            type: 'Identifier',
            name: 'arrayOptionToObject'
          }
        },
        arguments: args
      };
    }

  }
};

function filterModuleName(name) {
  return legacyModuleNameMap[name] || name;
}

function rename(oldpath, newpath) {
  fs.mkdirSync(path.dirname(newpath), {
    recursive: true
  });
  // Use git mv so that git status is less confusing
  // and "git checkout ." knows what to do if used
  const result = cp.spawnSync('git', [ 'mv', `./${oldpath}`, `./${newpath}` ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw result.stderr;
  }
}

function isSingleSiteProject() {
  return fs.existsSync('app.js') && fs.existsSync('lib/modules');
}

function isSingleNpmModule() {
  // There is no way to be absolutely sure it isn't some unrelated
  // kind of npm module, but this is a good sanity check
  return fs.existsSync('package.json') && fs.existsSync('index.js') && !fs.readFileSync('index.js', 'utf8').includes('moogBundle');
}

function isMoogBundle() {
  return fs.existsSync('package.json') && fs.existsSync('index.js') && fs.readFileSync('index.js', 'utf8').includes('moogBundle');
}

function nameToLiteralOrIdentifier(name) {
  if (name.value.computed) {
    return false;
  }
  if (name.value.type === 'Identifier') {
    return name.value;
  }
  if (name.value.type === 'Literal') {
    // Where possible convert to identifier
    const text = name.value.value;
    if (text.match(/^[a-zA-Z]\w*$/)) {
      return {
        type: 'Identifier',
        name: text
      };
    } else {
      return name.value;
    }
  }
  return false;
}

function unsupported() {
  const e = new Error('Unsupported');
  e.name = 'unsupported';
  return e;
}
