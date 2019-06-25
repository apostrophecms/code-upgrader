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

const inits = earlyInits.concat(lateInits);

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
          console.log(require('path').resolve(moduleName, path));
          const code = require('fs').readFileSync(require('path').resolve(moduleName, path), 'utf8');
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
              console.log('* * *');
              console.log(right);
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
