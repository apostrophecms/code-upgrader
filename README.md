[![CircleCI](https://circleci.com/gh/apostrophecms/code-upgrader/tree/master.svg?style=svg)](https://circleci.com/gh/apostrophecms/code-upgrader/tree/master)
[![Chat on Discord](https://img.shields.io/discord/517772094482677790.svg)](https://chat.apostrophecms.org)

<p align="center">
  <a href="https://github.com/apostrophecms/apostrophe">
    <!-- TODO:  -->
    <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">
  </a>

  <h1 align="center">Apostrophe Code Upgrader: A2 ➡ A3</h1>
</p>

The Code Upgrader handles a portion of the required modifications for an Apostrophe 2 (A2) codebase to run Apostrophe 3 (A3). It will also identify many specific lines and sections of code that a developer will need to convert manually.

**Status:** In development (not for production use)

## Purpose

### What it does

This module's features break down into two basic categories: "linting" for compatibility issues you can fix yourself, and "upgrading" code automatically. Since not everything can be upgraded automatically, the linting feature is important for everyone.

#### Linting for compatibility issues

This module's linting feature scans your project for modifications that likely need to be made to be compatible with A3. The lint command will work well with basically all projects and detects many issues. Here are just a few examples of what the linter can detect:

- The need to rename `lib/modules` to `modules`.
- The need to change `{{ apos.area(...) }}` to `{% area ... %}`.
- The need to move code from `construct()` to `methods()`, `handlers()`, etc.

Since the linter is very tolerant it is a good candidate for use with nearly all A2 projects that are migrating to A3.

#### Automated upgrading

This module can also carry out some upgrades automatically. While this is a great feature, keep in mind that not every module and project is a good candidate for automated code upgrading as there are an infinite number of ways projects can be structured. The upgrade feature works best on projects that adhere very closely to the coding style of the official A2 sample projects and documentation.

There are also many needed changes that the upgrade command cannot handle on its own. So a successful upgrade will always involve reviewing the output of the linting feature, as well as the Apostrophe documentation.

Where possible, the code upgrader will convert Apostrophe 2 codebases for installable modules *and* full A2 websites so they are *mostly ready* to run Apostrophe 3. This includes:
- Moving modules from `lib/modules` to the `modules` directory.
- Renaming most project-level Apostrophe core module customization directories to the A3 equivalents.
- Converting field schemas, columns, and similarly structured features to the A3 "cascade" configuration structure, if the existing module follows the structure of the official A2 example projects closely enough.
- Converting utility methods such as `addHelper()`, `apiRoute()`, and others to A3 module customization functions, again if the project closely follows the structure of the official A2 sample projects.
- Moving code in `beforeConstruct`, `construct`, and `afterConstruct` that can't otherwise be converted into appropriate A3 module functions.
- And more...

### What it doesn't do

The primary thing to understand is that this tool is not likely to make the project codebase 100% ready to use with Apostrophe 3 all by itself. Its mission is to significantly *reduce* the manual work required to do so, and help you discover what you have to do next.

*Some* of the things that you can expect to need to do manually include:
- jQuery-powered widget players (not "lean mode") due to their structure and lack of jQuery in A3 by default.
- "Anonymous" area configuration in template files. These configurations must be moved into the proper module's `index.js` schema definition.
- Some schema field and widget options due to the wide varation.
- Image widgets used for multi-image slideshows, as the A3 image widget only supports a single image.
- All or nearly all updates to files pulled into modules via `require`.

## Installation

To install the module:

```
npm install -g @apostrophecms/code-upgrader
```

The `apos-code-upgrader` command is now available in your command line shell.

## Project preparation

While the linting features leave your project as-is, the upgrade features will change most files in the codebase. It is important to prepare for this by making sure the project has version control active and ready to support this process. First and foremost, **the codebase must have git version control active**. This tool will stop if it cannot find evidence of git.

### Recommended steps

1. In the terminal, make sure you are in your project root.
2. Confirm that `git status` is clean (no active changes).
3. Make a **new branch** for the upgrade work (e.g., `3.0` or `a3-upgrade`). This will prevent any accidental problems from committing changes in the main branch.

## Linting the A2 codebase

Use the command `apos-code-upgrader lint` to run a linter scan of the A2 code. This will print to the console every required change it can find. This will *not* actually change any code. It is an especially useful step after you run the upgrade process, but it can be useful before to understand what changes to expect.

## Automatically upgrading the A2 codebase

1. Type `apos-code-upgrader upgrade` in the project root to have the tool actually convert code to A3's expected structure and syntax where possible. There may be immediate messages printed to the console suggesting next steps.
2. Run the linter command, `apos-code-upgrader lint`, to see any remaining changes that are detected and require manual conversion.
3. Review the changes (before committing them) with `git status` and `git diff HEAD`. Even though files are moved and directories renamed, git will still be able to display line changes for most of them.

Please note that you will definitely need to make manual changes to complete your upgrade.

### Options

The `upgrade` command supports the following additional command line option flags:

`--upgrade-required-files`

The upgrade command has experimental support for inlining certain `require`-d files in order to discover methods, handlers, etc. inside those files as well. This generally will not work well unless the required files limit their interesting logic to an exported function, which `index.js` invokes with `(self, options)`. You can try out this experimental feature by adding the `--upgrade-required-files` flag.

### Reset the changes before committing

If you want to undo all the changes made by the tool for any reason, run `apos-code-upgrader reset` in the project root. You must do this *before committing the changes*. This does a simple hard reset of your local branch with git and will let you start again after reviewing the changes if you desire.

As a last resort you can always switch back to the main git branch and create a new upgrade branch to start over. You did switch off the main branch at the start, didn't you? 🤓

