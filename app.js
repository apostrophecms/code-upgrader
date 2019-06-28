const moduleName = process.argv[2];
const code = require('fs').readFileSync(moduleName, 'utf8');
const esprima = require('esprima');
const escodegen = require('escodegen');
const parsed = esprima.parseScript(code);

const prologue = [];
const methods = [];
let earlyInits = [];
let lateInits = [];
let adjusts = [];
const options = [];
const apiRoutes = {};
const specials = {
  'extend': true,
  'improve': true,
  'moogBundle': true
};

const specialsFound = {};

let moduleBody;

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
          parseConstruct(value.body);
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
  if ((get(init, 'type') === 'ExpressionStatement') && (get(init, 'expression.type') === 'CallExpression') && (get(init, 'expression.callee.type') === 'MemberExpression') && (get(init, 'expression.callee.object.name') === 'self') && (get(init, 'expression.callee.property.name') === 'apiRoute')) {
    const args = get(init, 'expression.arguments');
    if (!args) {
      return true;
    }
    const method = get(args[0], 'value');
    const name = camelName(get(args[1], 'value'));
    if (!(method && name)) {
      return true;
    }
    let fns = args.slice(2);
    apiRoutes[method] = apiRoutes[method] || {};
    apiRoutes[method][name] = fns;  
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

if (Object.keys(apiRoutes).length) {
  moduleBody.properties.push({
    type: 'Property',
    key: {
      type: 'Identifier',
      name: 'apiRoutes'
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
              properties: Object.keys(apiRoutes).map(httpMethod => {
                return {
                  type: 'Property',
                  key: {
                    type: 'Identifier',
                    name: httpMethod
                  },
                  value: {
                    type: 'ObjectExpression',
                    properties: Object.keys(apiRoutes[httpMethod]).map(name => ({
                      type: 'Property',
                      key: {
                        type: 'Identifier',
                        name: name
                      },
                      value: middlewareAndRouteFunction(apiRoutes[httpMethod][name]),
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

if (methods.length) {
  moduleBody.properties.push({
    type: 'Property',
    key: {
      type: 'Identifier',
      name: 'methods'
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
                return {
                  type: 'Property',
                  key: {
                    type: 'Identifier',
                    name: method.name
                  },
                  value: method.statement.expression.right,
                  method: true
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

console.log(escodegen.generate(parsed));

function parseConstruct(body) {
  body.forEach(statement => {
    if (statement.type === 'ExpressionStatement') {
      if (statement.expression.type === 'AssignmentExpression') {
        const methodName = get(statement, 'expression.left.property.name');
        const fn = get(statement, 'expression.right');
        if (fn.type === 'FunctionExpression') {
          methods.push({
            name: methodName,
            statement: statement
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
          const parsed = esprima.parseScript(code);
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
                parseConstruct(right.body.body);
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

