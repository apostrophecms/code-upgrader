Here is a proposed replacement for the current `index.js` syntax for modules. This is not backwards compatible, it's the 3.0 format. However a conversion tool is under construction and will be used to convert apostrophe core itself, so we're serious about it.

**In general, we'd be deprecating the imperative, "build the module by calling stuff" style and replacing it with a declarative style, while avoiding technical terms and inside baseball.**

```javascript
// lib/modules/shoes/index.js, a pieces subclass

module.exports = (self, options) => ({

  extends: 'apostrophe-pieces',

  async init() {
    await self.connectToShoestoreBackend();
  },

  adjustOptions() {
    // A chance to modify options programmatically before the base class
    // sees them. I'm sure there are still use cases, but the ones that
    // leap to mind are covered by the new "fields" section, so this
    // will be rare now
  },

  // set up schema fields. If there are subclasses with fields they will
  // merge sensibly with what is done here

  fields: {
    add: {
      shoeSize: {
        type: 'integer',
        label: 'Shoe Size'
      }
      // ES2015 makes option-dependent fields easy
      ...(options.specialField ? {
        special: {
          type: 'whatever'
        }
      } : {})
    },
    remove: [ 'tags' ],
    arrange: {
      shoes: {
        label: 'Shoes',
        fields: [ 'shoeSize' ]
      }
    }
  },

  options: {
    // "Plain old options" now go in their own distinct section. They
    // override straightforwardly in subclasses
    searchable: false
    // "name" option for pieces is dead, defaults to module name
    // as it should have in the first place, sorry
  },

  methods: {
    async beforeSave(req, doc) {
      ... code for this method ...
      // having self in scope is key here
      self.doSomething();
    },
    doThing() {
      ... code for this method ...
    },
    doOtherThing() {
      ... code for this method ...
    }
  },

  extendMethods: {
    async beforeSave(_super, req, doc, options) {
      await _super(req, doc, options);
      doSomethingMore();
    }
  },

  handlers: {
    'apostrophe-pages:beforeSend': {
      // Named so they can be extended
      addPopularProducts: async function(req) { ... },
      addBoringBooks: async function(req) { ... }
    }
  },
 
  extendHandlers: {
    'apostrophe-pages:beforeSend': {
      // Inherited from base class, we can use _super to
      // invoke the original and do more work
      addNavigation: async function(_super, req) { ... }
    }
  },

  helpers: {
    includes(arr, item) {
      return arr.includes(item);
    }
  },

  extendHelpers: {
    // Extend a base class helper called colorCode with a new default
    colorCode(_super, item) {
      const color = _super(item);
      return color || 'red';
    }
  },
  
  apiRoutes: {
    post: {
      async trackHit(req) {
        // route becomes /modules/modulename/track-hit, auto-hyphenation so we can
        // use nice camelcase method names to define routes
        return self.apos.docs.db.update({ _id: req.body._id },
          { $inc: { hits: 1 } }
        );
      }
    }
  },

  extendApiRoutes: {
    post: {
      // insert route is inherited from base class, let's
      // extend the functionality
      async insert(_super, req) {
        await _super(req);
        // Now do something more...
      }
    }
  },

  components: {
    // In template: {% component 'shoes:brandBrowser' with { color: 'blue' } %}
    async brandBrowser(req, data) {
      // Renders the `brandBrowser.html` template of this module,
      // with `data.brands` available containing the results of this
      // third party API call
      return {
        // Pass on parameter we got from the component tag in the template
        brands: await rq('https://shoebrands.api', { color: data.color })
      };
    }
  },

  extendComponents: {
    // Extend a component's behavior, reusing the original to do most of the work 
    async brandBrowser(_super, req, data) {
      const result = await _super(req, data); 
      if (result.color === 'grey') {
        result.color = 'gray';
      }
      return result;
    }
  }
});
```

Why do we think this is better?

* Exporting a single wrapper function that accepts self and options and returns an object addresses the issue of making sure we have a lexically scoped replacement for `this` and access to the module options at all times. (Note that before `init` runs, `self.options` will be set, so you can have a local `options` argument to a method without problems. This has always been the case.)
* `init` is a common name in other frameworks for a function that runs as soon as the module is fully constructed and ready to support method calls, etc. This replaces the inside-baseball name `afterConstruct`.
* `adjustOptions` is, again, descriptive of purpose. It replaces `beforeConstruct`. The purpose has always been to modify `options`, before the base class gets to see them: subclasses run `adjustOptions` before their parent classes. This is similar to features found in C++. While `self` is in scope here, it isn't useful yet.
* `methods` is a simple and descriptive name, familiar from Vue, which has been very successful in achieving developer acceptance, even though Vue also does not use ES6 classes for not entirely dissimilar reasons. In general, Vue components have been designed with simple and descriptive language wherever possible, and we can learn from that and avoid inside baseball jargon.
* `extendMethods` is a similar, however here each method's first argument is `_super`, where `_super` is a reference to the method we're overriding from a parent class. We now have complete freedom to call `_super` first, last, or in the middle in our new function. It is much less verbose than our current `super` pattern. Organizing all of these extensions in `extendMethods` makes the intent very clear. Note that if you just want to "override" (replace) a method, you declare it in `methods` and that straight up crushes the inherited method. `extendMethods` is for scenarios where you need reuse of the original method as part of the new one. We use `_super` because `super` is a reserved word.
* `handlers` and `extendHandlers` provide similar structure for promise event handlers. Again, these get grouped together, making them easier to find, just like Vue groups together `computed`, `methods`, etc. As always, handlers must be named. Handlers for the same event are grouped beneath it. This is loosely similar to Vue lifecycle hooks, but intentionally not identical because Apostrophe involves inheritance, and everything needs to be named uniquely so it can be overridden or extended easily.
* `helpers` and `extendHelpers`: you get the idea. For nunjucks helpers.
* `apiRoutes` and `extendApiRoutes`: you'd actually be able to add `apiRoutes`, `htmlRoutes` and plain old `routes`. see recent Apostrophe changelogs if this is unfamiliar. Note subproperties separating routes of the same name with different HTTP methods.
* `fields`: just... just look at it. This clobbers addFields/removeFields with tons of beforeConstruct boilerplate.

"What about breaking a module into multiple files?" Well that's a good question, we do this now and it's a good thing. But, nobody's stopping anyone from using `require` in here. It would work like it does today, you'd pass in `self` or `self, options` to a function in the required file.


## What about middleware for routes?

In 2.x, you can write:

```javascript
self.apiRoute('post', 'upload', self.middleware.canUpload, function(req, res, next) {
  ...
});
```

And the route function gets wrapped by the specified middleware function.

In the new format writing `self.middleware.canUpload` can't easily work because the middleware function would not be attached to `self` yet. Also it is hard to see how it fits into the new syntax:

```javascript
apiRoutes: {
  post: {
    // Where does the canUpload middleware go?
    async upload(req) {}
  }
}
```

There is a lot of Express compatible middleware that comes in handy for individual routes, so saying "invoke methods instead" isn't reasonable.

One possible resolution is to introduce a section for middleware, and call it out by name when setting up the route:

```javascript
middleware: {
  canUpload: function(req, res, next) { ... }
},
apiRoutes: {
  post: {
    upload: [
      'canUpload',
      async (req) { ... }
    ]
  }
}
```

Middleware coming from other modules can also be called out with cross-module syntax:

```javascript
apiRoutes: {
  post: {
    upload: [
      'other-module:canUpload',
      async (req) { ... }
    ]
  }
}
```

And generic connect middleware can just be passed inline.

Here are some alternatives:

```javascript
apiRoutes: {
  post: {
    async upload(req) {}
  }
},
middleware: {
  canUpload: function(req, res, next) {
  }
},
useMiddleware: {
  'always': [ array of middleware names to apply to all routes globally ],
  'module': [ array of middleware names to apply to all routes in this module ],
  'routes': {
    post: {
      upload: [ 'canUpload' ]
    }
  }
}
```

```javascript
apiRoutes: {
  post: {
    async upload(req) {
      // Use composition. `self.useMiddleware` is a convenience function for this
      return self.useMiddleware(self.middleware.canUpload, function(req) {
        ...
      });
    }
  }
},
middleware: {
  canUpload: function(req, res, next) {
  }
},
useMiddleware: {
  'always': [ array of middleware names to apply to all routes globally ],
  'module': [ array of middleware names to apply to all routes in this module ],
  'routes': {
    post: {
      upload: [ 'canUpload' ]
    }
  }
}
```

The first syntax is the best: it's closest to the spirit of an Express `app.post` call with middleware, and it doesn't separate the selection of middleware to use from the route.

However the `middleware` and `useMiddleware` sections are a good idea. I like this:

```javascript
middleware: {
  canUpload: function(req, res, next) { ... },
  ensureData: function(req, res, next) {
    req.data = req.data || {};
    return next();
  }),
  editor: function(req, res, next) {
    if (!self.apos.permissions.can('edit')) {
      return res.status(401).send('unauthorized');
    }
    return next();
  } 
},
extendMiddleware: {
  // The usual _super pattern applies here
},
useMiddleware: {
  always: [ 'ensureData' ],
  // The usual cross-module syntax is valid here, to apply middleware
  // defined in one module to all routes of another
  module: [ 'editor' ]
},
apiRoutes: {
  post: {
    upload: [
      'canUpload',
      async (req) { ... }
    ],
    async insert(req) {
      // No route-specific middleware, but always covered by ensureData and editor
      // middleware, because it is in this module
    }
  }
}
```

Cool.

In addition, this opens the door to a pattern for async functions as middleware.
Single-argument functions (taking only req) would be awaited. If they reject, we handle
it just like a rejection from the type of route they are applied to (apiRoute, etc).
If they resolve to undefined, we continue, i.e. the
equivalent of next() is default behavior. If they resolve to any other value,
we handle it like a return value from apiRoute. A drawback is that we have to
await things that might be synchronous, which is a small perf hit if the middleware
could have been synchronous, but you can always write a standard middleware function instead.

Eh, I think this is A Lot, middleware doesn't need to change its pattern for us.

## Creating custom URLs for routes

We have a lot of cool functionality to help write safe, reliable routes. We should make it
available when using a custom URL, not the module prefix.

This is easier than I thought: we just give it a name starting with `/`.

```javascript
apiRoutes: {
  post: {
    // Leading / turns off automatic css-casing and automatic mapping to a module URL
    '/track-hit': async (req) => {
      // route becomes /modules/modulename/track-hit, auto-hyphenation so we can
      // use nice camelcase method names to define routes
      return self.apos.docs.db.update({ _id: req.body._id },
        { $inc: { hits: 1 } }
      );
    }
  }
}
```

**** Summary of the further changes for the team

## Proposal for middleware in 3.x, and to make nonstandard route URLs easy

Where does Express middleware go when you add a route? How about global middleware provided by a module? How can we promote middleware reuse? How do we address the use cases of the expressMiddleware property of 2.x, including the `when` option?

```javascript
module.exports = (self, options) => ({
  middleware: {
    canUpload(req, res, next) { ... make sure they are allowed },
    ensureData(req, res, next) {
      req.data = req.data || {};
      return next();
    }),
    editor(req, res, next) {
      if (!self.apos.permissions.can('edit')) {
        return res.status(401).send('unauthorized');
      }
      return next();
    } 
  },
  extendMiddleware: {
    // The usual _super pattern applies here, can extend any named
    // middleware function we inherited
  },
  useMiddleware: {
    // Use for ALL routes, globally. These are applied in module init order
    always: [ 'ensureData' ],
    // Used for ALL routes, but applied before 'always' middleware of a certain module
    before: {
      moduleName: [ 'someMiddlewareName' ]
    },
    // 
    // The usual cross-module syntax is valid here, to apply middleware
    // defined in one module to all routes of another
    module: [ 'editor' ]
  },
  apiRoutes: {
    post: {
      // This route needs route-specific middleware. Also see useMiddleware
      upload: [
        'canUpload',
        async (req) => { ... }
      ],
      async insert(req) {
        // No route-specific middleware, but see useMiddleware for
        // things that cover it anyway
      }
      // Leading / turns off automatic css-casing and automatic mapping to a module URL.
      // Presto, public API at a non-Apostrophe-standard URL
      '/track-hit': async (req) => {
        // route becomes /modules/modulename/track-hit, auto-hyphenation so we can
        // use nice camelcase method names to define routes
        return self.apos.docs.db.update({ _id: req.body._id },
          { $inc: { hits: 1 } }
        );
      }
    }
  }
});
```

I looked at a lot of alternatives to this syntax for a route that needs
route-specific middleware:

```javascript
    // Single tear for losing the method syntax here
    upload: [
      'canUpload',
      async (req) => { ... }
    ],
```

All of them were really verbose, but they led me to the idea of `useMiddleware`, and we need
something like it to replace the `self.expressMidleware = ...` kludge from 2.x.

Note you can pass actual middleware functions directly if you want to, and at project level
that's handy with stuff coming from npm:

```javascript
const coolNpmMiddleware = require('cool-npm-middleware');

module.exports = (self, options) => ({
  apiRoutes: {
    post: {
      upload: [
        coolNpmMiddleware,
        async (req) => { ... }
      ],
    }
  }
});
```

This too:

```javascript
const coolNpmMiddleware = require('cool-npm-middleware');

module.exports = (self, options) => ({
  useMiddleware: {
    always: [ 'coolNpmMiddleware' ]
  },
  apiRoutes: {
    post: {
      upload: [
        coolNpmMiddleware,
        async (req) => { ... }
      ],
    }
  }
});
```

But if you give it a name in `middleware` it becomes possible to override or extend it when using `improve`, etc.

