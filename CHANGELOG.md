# Changelog

## 1.0.0-beta.2 (2023-02-01)

- `upgrade` command now also supports A2 projects powered by `apostrophe-multsite`.

## 1.0.0-beta (2022-01-21)

- Linter now looks for `webpack.config.js` and explains possible alternatives and options.

## 1.0.0-alpha.2 (2021-12-08)

- Adds a prompt before the upgrade script runs to confirm the user wants to proceed.
- Adds helpful message about using "git diff HEAD" after running the upgrade command.
- Display lint messages in source code order, even if they are for a mix of issues.
- Lint for array field schema properties that need conversion.
- Lint for joinByArray field sub-schema properties that need conversion.
- Lint for joinByOne, joinByArray, joinbyOneReverse, and joinByArrayReverse.
- Lint for widget output method overrides.
- Lint for `filterOptionsForDataAttribute`.
- Lint for methods that should move to the "methods" section.
- Lint for tasks that should move to the "tasks" section.
- Lint for `self.route`, `self.apiRoute`, `self.htmlRoute`, and `self.renderRoute`.

## 1.0.0-alpha.1 (2021-12-03)

- Adds missing `glob` npm dependency needed for `npm install -g`. Previously a transient dependency allowed this to work in some cases but not all.

## 1.0.0-alpha (2021-11-23)

- First alpha release.
