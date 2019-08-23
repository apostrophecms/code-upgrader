const moduleName = process.argv[2];
const code = require('fs').readFileSync(moduleName, 'utf8');
const esprima = require('esprima');
const escodegen = require('escodegen');
const parsed = esprima.parseScript(code, { comment: true, loc: true });
const prologue = [];
let methods = [];
let earlyInits = [];
let lateInits = [];
let adjusts = [];
const options = [];
const routes = {};
const superCaptures = {};
const moveMethodsToHandlers = [];
const specials = {
  'extend': true,
  'improve': true,
  'moogBundle': true
};

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
        specialsFound[name] = get(property, 'value');
      } else {
        options[name] = get(property, 'value');
      }
    });
  }
});

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
  } else if ((get(init, 'type') === 'ExpressionStatement') && (get(init, 'expression.type') === 'CallExpression') && (get(init, 'expression.callee.object.name') === 'self') && (get(init, 'expression.callee.property.name') === 'on')) {
    const arguments = get(init, 'expression.arguments');
    if ((arguments[0].type !== 'Literal') || (arguments[1].type !== 'Literal')) {
      return true;
    }
    if (!arguments[2]) {
      const fullEventName = arguments[0].value;
      const handlerName = arguments[1].value;
      handlers[fullEventName] = handlers[fullEventName] || {};
      // moveMethodsToHandlers.push([ fullEventName, handlerName ]);
      return false;
    } else if (arguments[2].type !== 'FunctionExpression') {
      return true;
    }
    const fullEventName = arguments[0].value;
    const handlerName = arguments[1].value;
    const handler = arguments[2];
    handler.comments = getCommentsBefore(handler);
    handlers[fullEventName] = handlers[fullEventName] || {};
    handlers[fullEventName][handlerName] = handler;
  } else if ((get(init, 'type') === 'VariableDeclaration') && (get(init, 'declarations.0.id.name').match(/^super/))) {
    superCaptures[get(init, 'declarations.0.init.property.name')] = get(init, 'declarations.0.id.name');
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
      name: 'adjustOptions'
    },
    value: {
      type: 'FunctionExpression',
      params: [
        {
          'type': 'Identifier',
          'name': 'self'
        },
        {
          'type': 'Identifier',
          'name': 'options'
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
          'type': 'Identifier',
          'name': 'self'
        },
        {
          'type': 'Identifier',
          'name': 'options'
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
      "params": [
        {
          "type": "Identifier",
          "name": "self"
        },
        {
          "type": "Identifier",
          "name": "options"
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
  handlers[item[0]][item[1]].comments = method.comments;
  console.log(handlers[item[0]][item[1]].comments );
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
      "params": [
        {
          "type": "Identifier",
          "name": "self"
        },
        {
          "type": "Identifier",
          "name": "options"
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
                    "type": "Literal",
                    "value": eventName
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
                      leadingComments: handlers[eventName][name].comments,
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

outputMethods('methods', methods);
outputMethods('extendMethods', extendMethods);

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
        "params": [
          {
            "type": "Identifier",
            "name": "self"
          },
          {
            "type": "Identifier",
            "name": "options"
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
                    leadingComments: method.comments
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

const required = {};

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
  const varName = get(declaration, 'id.name');
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

console.log(escodegen.generate(parsed, { comment: true }));

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
            comments: getCommentsBefore(statement)
          });
          return;
        }
      } else if ((statement.expression.type === 'CallExpression') && (get(statement, 'expression.callee.callee.name') === 'require')) {
        const arguments = get(statement, 'expression.arguments');
        if ((arguments.length === 2) && (arguments[0].name === 'self') && (arguments[1].name === 'options')) {
          const path = get(statement, 'expression.callee.arguments.0.value');
          // recurse into path
          let fsPath = require('path').resolve(require('path').dirname(moduleName), path);
          if (!fsPath.match(/\.js$/)) {
            fsPath += '.js';
          }
          const code = require('fs').readFileSync(fsPath, 'utf8');
          const parsed = esprima.parseScript(code, { comment: true, loc: true });
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

function get(o, s) {
  if (o == null) {
    return null;
  }
  clauses = s.split(/\./);
  clauses.forEach(c => {
    if (o[c] == null) {
      return null;
    }
    o = o[c];
  });
  return o;
};

function middlewareAndRouteFunction(fns) {
  if (fns.length === 1) {
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
    let c = s.charAt(i);
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

function getCommentsBefore(statement) {
  const commentsBefore = statement.loc.start.line;
  const comments = [];
  let i = parsed.comments.findIndex(comment => {
    return (comment.loc.end.line === (commentsBefore - 1)) || (comment.loc.end.line === (commentsBefore - 2));
  });
  if (i === -1) {
    return [];
  }
  comments.push(parsed.comments[i]);
  while (true) {
    const j = parsed.comments.findIndex(comment => {
      return comment.loc.end.line === (parsed.comments[i].loc.start.line - 1);
    });
    if (j === -1) {
      break;
    }
    comments.push(parsed.comments[j]);
    i = j;
  }
  comments.reverse();
  return comments;
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
    const comments = getCommentsBefore(init);
    let fns = args.slice(2);
    fns[0].comments = comments;
    routes[type] = routes[type] || {};
    routes[type][method] = routes[type][method] || {};
    routes[type][method][name] = fns;
    return true;
  } else {
    return false;
  }
}
