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
    async beforeSave(super, req, doc, options) {
      await super(req, doc, options);
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
      // Inherited from base class, we can use super to
      // invoke the original and do more work
      addNavigation: async function(super, req) { ... }
    }
  },

  helpers: {
    includes(arr, item) {
      return arr.includes(item);
    }
  },

  extendHelpers: {
    // Extend a base class helper called colorCode with a new default
    colorCode(super, item) {
      const color = super(item);
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
      async insert(super, req) {
        await super(req);
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
    async brandBrowser(super, req, data) {
      const result = await super(req, data); 
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
* `extendMethods` is a similar, however here each method's first argument is `super`, where `super` is a reference to the method we're overriding from a parent class. We now have complete freedom to call `super` first, last, in the middle, or not at all in our new function. It is much less verbose than our current `super` pattern. Organizing all of these extensions in `extendMethods` makes the intent very clear. Note that if you just want to "override" (replace) a method, you declare it in `methods` and that straight up crushes the inherited method. `extendMethods` is for scenarios where you need reuse of the original method as part of the new one.
* `handlers` and `extendHandlers` provide similar structure for promise event handlers. Again, these get grouped together, making them easier to find, just like Vue groups together `computed`, `methods`, etc. As always, handlers must be named. Handlers for the same event are grouped beneath it. This is loosely similar to Vue lifecycle hooks, but intentionally not identical because Apostrophe involves inheritance, and everything needs to be named uniquely so it can be overridden or extended easily.
* `helpers` and `extendHelpers`: you get the idea. For nunjucks helpers.
* `apiRoutes` and `extendApiRoutes`: you'd actually be able to add `apiRoutes`, `htmlRoutes` and plain old `routes`. see recent Apostrophe changelogs if this is unfamiliar. Note subproperties separating routes of the same name with different HTTP methods.
* `fields`: just... just look at it. This clobbers addFields/removeFields with tons of beforeConstruct boilerplate.

"What about breaking a module into multiple files?" Well that's a good question, we do this now and it's a good thing. But, nobody's stopping anyone from using `require` in here. It would work like it does today, you'd pass in `self` or `self, options` to a function in the required file.

