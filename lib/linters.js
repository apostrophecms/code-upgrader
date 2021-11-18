const { stripIndent} = require('common-tags');

module.exports = {
  addHelpers: {
    match: /addHelpers\s*\(/g,
    message: 'Migrate this code to the new "helpers" module initialization function.',
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#helpers-self'
  },
  addHelperShortcut: {
    match: /addHelperShortcut\s*\(/g,
    message: 'Removed in A3. We suggest adding a module alias and namespacing your helper calls.',
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-options.html#alias'
  }
};
