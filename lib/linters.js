const { stripIndent } = require('common-tags');
const legacyModuleNameMap = require('./legacy-module-name-map');

const js = {
  addHelpers: {
    match: /addHelpers\s*\(/g,
    message: 'Migrate this code to the new "helpers" module initialization function.',
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#helpers-self'
  },
  addHelperShortcut: {
    match: /addHelperShortcut\s*\(/g,
    message: 'Removed in A3. We suggest adding a module alias and namespacing your helper calls.',
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-options.html#alias'
  },
  construct: {
    match: /construct:?\s*\(/g,
    message: stripIndent`
      Removed in A3. Methods must move to the methods section, routes to various route
      sections, event handlers to the handlers section, etc. Other code executing at
      startup should move to init(self, options).
    `,
    url: 'https://v3.docs.apostrophecms.org/guide/upgrading.html#new-features'
  },
  beforeConstruct: {
    match: /beforeConstruct:?\s*\(/g,
    message: stripIndent`
      Removed in A3. Code that adjusts addFields, removeFields, etc. should move to the
      new fields section. Similar sections exists for columns and other items adjusted
      here in A2. beforeSuperClass(self, options) is also available but it is
      highly likely that you do not need it.
    `,
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#fields'
  },
  afterConstruct: {
    match: /afterConstruct:?\s*\(/g,
    message: stripIndent`
      Renamed to init() in A3. init() may be async and will be awaited.
      No callback will be passed.
    `
  },
  callback: {
    match: /callback|cb\)/g,
    message: stripIndent`
      A3 does not use callbacks. If you are using a callback here to interface
      with a third-party library that uses callbacks you should use
      util.promisify() to wrap that function, making it awaitable.
    `
  },
  asyncModule: {
    match: /async\./g,
    message: stripIndent`
      The use of the async npm module is not recommended in A3 which natively
      supports async/await patterns. If you need to iterate over data you can "await"
      inside a "for...of" loop.
    `
  },
  lifecycleMethods: {
    match: /self.(beforeInsert|beforeUpdate|beforeSave|afterInsert|afterUpdate|afterSave)/g,
    message: stripIndent`
      Piece types no longer have overrideable lifecycle methods in A3. Instead
      you should write a handler for the corresponding event in the
      handlers(self, options) section.
    `,
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#handlers-self'
  },
  selfOn: {
    match: /self\.on/g,
    message: stripIndent`
      Rather than calling self.on() directly to set up an event handler you should
      use the new handlers(self, options) section.
    `,
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#handlers-self'
  },
  name: {
    matchParsed(parsed) {
      return parsed.exports.name;
    },
    message: stripIndent`
      In A3, piece and widget types no longer have a "name" option. For piece types,
      you should rename this module and its directory to the old "name" setting and
      remove the setting. For widget types, you should rename the module and its
      directory to the old "name" setting with "-widget" appended and remove
      the setting.
    `,
    url: 'https://v3.docs.apostrophecms.org/guide/upgrading.html#breaking-changes'
  },
  addFields: {
    match: /addFields/g,
    message: stripIndent`
      The addFields option has been replaced by the "add" subproperty of the
      "fields" section. Array fields can have their own "fields" section.
    `,
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#fields'
  },
  removeFields: {
    match: /removeFields/g,
    message: stripIndent`
      The removeFields option has been replaced by the "remove" subproperty of the
      "fields" section. Array fields can have their own "fields" section.
    `,
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#fields'
  },
  arrangeFields: {
    match: /arrangeFields/g,
    message: stripIndent`
      The arrangeFields option has been replaced by the "group" subproperty of the
      "fields" section. Array fields can have their own "fields" section.
    `,
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#fields'
  },
  pushScriptForUsers: {
    match: /pushAsset/g,
    message: stripIndent`
      The pushAsset method is no longer used in A3. Frontend scripts can be placed
      in the ui/src/index.js file of the module or a file imported into it
      with the import statement. ui/src/index.js must export a function, which
      will be invoked in the order in which modules are activated.

      Frontend stylesheets can be placed in the ui/src/index.scss file of the module
      or a file imported into it with the @import statement.

      Backend scripts and stylesheets for the admin UI must be repackaged in Vue.
    `
  },
  methods: {
    match: /self\.\w+\s*=.*?(function|=>)/g,
    message: stripIndent`
      Method definitions should be moved to the new "methods" section of the module,
      unless you are extending an existing method with the old "super" pattern, in
      which case they should move to the new "extendMethods" section, with a
      "_super" argument at the beginning.
    `,
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#methods'
  },
  browserCall: {
    match: /apos\.push\.browserCall/g,
    message: stripIndent`
      The "apos.push.browserCall" mechanism does not exist in A3. See the
      new "enableBrowserData" method and implement or extend the "getBrowserData"
      method to make data available at page load time in the browser, or
      add data attributes to your markup, or use the REST API after page load time.
    `
  },
  reqCall: {
    match: /req\.browserCall/g,
    message: stripIndent`
      The "req.browserCall" mechanism does not exist in A3. See the
      new "enableBrowserData" method and implement or extend the "getBrowserData"
      method to make data available at page load time in the browser, or
      add data attributes to your markup, or use the REST API after page load time.
    `
  },
  tagsField: {
    match: /type:\s*["']tags[".]/g,
    message: stripIndent`
      There is no "tags" field type in A3. If you need tags for a particular
      piece type, add a piece type for that purpose and create a "relationship"
      field to connect them.
    `
  },
  tagsModule: {
    match: /apos\.tags|apostrophe-tags/g,
    message: stripIndent`
      There is no "apostrophe-tags" module in A3. If you need tags for a particular
      piece type, add a piece type for that purpose and create a "relationship"
      field to connect them.
    `
  },
  joinByOne: {
    match: /joinByOne/g,
    message: stripIndent`
      Apostrophe A3 has no "joinByOne" field type. Use the "relationship" field
      type instead and set both "required: true" and "max: 1". The loaded data will
      appear as an array with a single element.
    `
  },
  joinByOneReverse: {
    match: /joinByOneReverse/g,
    message: stripIndent`
      Apostrophe A3 has no "joinByOneReverse" field type. Change your "joinByOne"
      field to a "relationship" field as noted elsewhere, then change "joinByOneReverse"
      to "relationshipReverse".
    `
  },
  joinByArray: {
    match: /joinByArray/g,
    message: stripIndent`
      In A3 the "joinByArray" field type has been renamed to "relationship".
    `
  },
  joinByArrayReverse: {
    match: /joinByArrayReverse/g,
    message: stripIndent`
      Apostrophe A3 has no "joinByArrayReverse" field type. Change your "joinByArray"
      field to a "relationship" field as noted elsewhere, then change "joinByArrayReverse"
      to "relationshipReverse".
    `
  },
  tasks: {
    match: /apos\.tasks\.add|self\.addTask/g,
    message: stripIndent`
      Apostrophe tasks have moved to the new "tasks" section.
    `,
    url: 'https://v3.docs.apostrophecms.org/reference/module-api/module-overview.html#tasks'
  },
  widgetOutput: {
    match: /self\.output\s*=/g,
    message: stripIndent`
      Overriding the "output" method of a widget module is usually unnecessary
      as it simply renders the template. If you must override it be aware
      that the arguments have changed to:
      
      "req, widget, options, _with"
      
      Also, the output method is now async.
    `
  },
  filterOptionsForDataAttribute: {
    match: /filterOptionsForDataAttribute/g,
    message: stripIndent`
      filterOptionsForDataAttribute is not needed in A3, as A3 does not add any data
      attributes to a widget by default, except when editing. Your widget templates
      are responsible for making any needed data available to widget players via data
      attributes.
    `
  },
  addFieldType: {
    match: /(schema|self)\.addFieldType/g,
    message: stripIndent`
      Be aware that addFieldType has changed in A3. There is just one "convert"
      method per field type, which should accept either a string representation
      for import purposes (CSV, etc) and may also accept a different representation
      for form submissions where appropriate. "convert" may be async and now receives
      these arguments, typically copying from "data[field.name]" to
      "destination[field.name]" after sanitization:

      "req, field, data, destination"
    `
  },
  joinByArraySchema: {
    match: /(joinByArray|relationship)[\s\S]{1,1000}schema["']?:/,
    message: stripIndent`
      It looks like you may have a joinByArray or relationship field
      with a schema. In addition to changing "joinByArray" to "relationship",
      you will need to change "schema" to a "fields" property with
      an "add" subproperty, structured the same way as the "fields"
      section of a module.
    `
  },
  arraySchema: {
    match: /(["']array["'])[\s\S]{1,1000}schema["']?:/,
    message: stripIndent`
      It looks like you may have an array field with a schema. You will need to
      change "schema" to a "fields" property with an "add" subproperty, structured
      the same way as the "fields" section of a module.
    `
  }
};

const html = {
  area: {
    match: /apos\.area\s*\(/g,
    message: stripIndent`
      A3 uses the new {% area doc, 'areaName' %} syntax. Note the use of
      {% ... %}, not {{ ... }}. Every area must be configured in the schema
      of a piece type, page type or widget. An object of context options can
      be passed after the "with" keyword, with one property for each widget
      type, and appear as "data.contextOptions" in the widget.html template.
    `,
    url: 'https://v3.docs.apostrophecms.org/guide/upgrading.html#areas-and-pages'
  },
  singleton: {
    match: /apos\.singleton/g,
    message: stripIndent`
      A3 no longer has a separate "singleton" field type. Use the new
      {% area doc, 'areaName' %} syntax. Configure the area in the schema
      of a piece type, page type or widget with "max" set to 1.
    `,
    url: 'https://v3.docs.apostrophecms.org/guide/upgrading.html#areas-and-pages'
  },
  macro: {
    match: /{%\s*macro/g,
    message: stripIndent`
      In A3, Nunjucks macros cannot contain areas, but fragments can.
      Fragments are very similar to macros and can do the same tasks.
      It is recommended that you change all of your macros to fragments.
      Be aware that "with context" is not supported by fragments.
      See the documentation for details on how best to do this.
    `,
    url: 'https://v3.docs.apostrophecms.org/guide/fragments.html'
  }
};

// A special case, with support for matchName and matchFilename

const lintModule = {
  widgets: {
    matchName: /-widgets$/,
    message: stripIndent`
      In A3, widget module names must end in -widget, preceded by what
      would have been set for the "name" option in A2. The "name" option,
      if still present, should be removed.
    `
  },
  libModules: {
    matchFilename: /lib\/modules/,
    message: stripIndent`
      In A3, the "lib/modules" folder must be renamed "modules" in order
      to be recognized. You may choose to keep utility code in "lib",
      only Apostrophe modules need to be moved.
    `,
    once: true
  },
  legacyModules: {
    matchName: name => legacyModuleNameMap[name],
    message: ({ name }) => stripIndent`
      In A3, the ${name} module has been renamed ${legacyModuleNameMap[name]}.
    `
  }
};

module.exports = {
  js,
  html,
  module: lintModule,
  // Apostrophe also supports .njk files
  njk: html
};
