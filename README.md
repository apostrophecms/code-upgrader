NOT ready for use.

When it is, usage will look like:

```
cd lib/modules/whatever
apostrophe-3-upgrade-module index.js
```

That will *replace* `index.js` with a new version, which will also contain, inlined, the content of any files pulled in with the `require('./lib/something')(self, options)` pattern. Those files are removed.

This may sound scary, and indeed it is imperfect and you may have changes to make. However, that is why we have `git`. You can review the changes as a PR in github, or via `git diff`. Just make sure you work in a new git branch when using this tool.

(If you are not using git for version control, we recommend that you start. If you're not going to start, we don't recommend using the upgrade tool.)
