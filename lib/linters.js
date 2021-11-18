const { stripIndent} = require('common-tags');

module.exports = {
  addHelpers: {
    match: /addHelpers\s*\(/,
    message: 'Migrate this code to the new "filters" module initialization function.',
    link: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#helpers-self'
  },
  addHelperShortcut: {
    match: /addHelperShortcut\s*\(/,
    message: 'Removed in A3. We suggest adding a module alias and namespacing your helper calls.',
    link: 'https://v3.docs.apostrophecms.org/reference/module-api/module-options.html#alias'
  }
};
