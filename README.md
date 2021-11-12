[![CircleCI](https://circleci.com/gh/apostrophecms/apostrophe-3-upgrade-tools/tree/master.svg?style=svg)](https://circleci.com/gh/apostrophecms/apostrophe-3-upgrade-tools/tree/master)

NOT ready for use.

Current test procedure:

* `git clone` this module
* `npm install`
* `cd` to your project
* make sure `git status` is clean
* make a **new branch** for the migration
* make sure you are cd'd into your project
* `~/apostrophecms/apostrophe-3-upgrade-tools .`
* Check out `git status`
* **To undo everything and try again:** `git reset --hard && git clean -df`

This tool will refuse to start if it does not see a git repository for the project. Please do not use this tool without appropriate version control to avoid losing 2.x project code.

This will rename `lib/modules` to `modules`, update every `index.js` file and make many other changes, including inlining the content of any files pulled in with the `require('./lib/something')(self, options)` pattern. Those files are removed.

This may sound scary, and indeed it is imperfect and you may have changes to make. However, that is why we have `git`. You can review the changes as a PR in github, or via `git diff HEAD`. Just make sure you work in a new git branch when using this tool.
