[![CircleCI](https://circleci.com/gh/apostrophecms/code-upgrader/tree/master.svg?style=svg)](https://circleci.com/gh/apostrophecms/code-upgrader/tree/master)
[![Chat on Discord](https://img.shields.io/discord/517772094482677790.svg)](https://chat.apostrophecms.org)

<p align="center">
  <a href="https://github.com/apostrophecms/apostrophe">
    <!-- TODO:  -->
    <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">
  </a>

  <h1 align="center">Apostrophe Code Upgrader: A2 ➡ A3</h1>
</p>

The Code Upgrader handles the majority of required modifications for an Apostrophe 2 (A2) codebase to run Apostrophe 3 (A3). It will also identify many specific lines and sections of code that a developer will need to convert manually.

**Status:** In development (not for production use)

## Purpose

### What it does

The code upgrader will convert Apostrophe 2 codebases for installable modules *and* full A2 websites so they are *mostly ready* to run Apostrophe 3. This includes:
- Moving modules from `lib/modules` to the `modules` directory.
- Renaming most project-level Apostrophe core module customization directories to the A3 equivalents.
- Converting field schemas, columns, and similarly structured features to the A3 "cascade" configuration structure.
- Converting utility methods such as `addHelper()`, `apiRoute()`, and others to A3 module customization functions.
- Moving code in `beforeConstruct`, `construct`, and `afterConstruct` that can't otherwise be converted into appropriate A3 module functions.
- Inlining the content of any files used in module configuration with the `require('./lib/something')(self, options)` pattern. This allows the tool to run the rest of its actions on that code as well. Those complete "required" files are removed.
- And more...

There is also a linter operation available to understand what will be changed as well as what could not be changed (following the upgrade process).

Not every module and project is a good candidate for automated code upgrading as there are an infinite number of ways projects can be structured. The `upgrade` command works best on projects that adhere very closely to the coding style of the official A2 sample projects and documentation.

### What it doesn't do

The primary thing to understand is that this tool is not likely to make the project codebase 100% ready to use with Apostrophe 3. Its mission is to significantly *reduce* the manual work required to do so.

*Some* of the things that you can expect to need to do manually include:
- jQuery-powered widget players (not "lean mode") due to their structure and lack of jQuery in A3 by default.
- "Anonymous" area configuration in template files. These configurations must be moved into the proper module's `index.js` schema definition.
- Some schema field and widget options due to the wide varation.
- Image widgets used for multi-image slideshows, as the A3 image widget only supports a single image.

## Pre-stable testing

To test the upgrader prior to stable publication:

1. `git clone` this module outside of any Apostrophe codebase.
2. `npm install` in the upgrader's directory.
3. Type `npm link` to make `apos-code-upgrader` globally available on your machine.

## Project preparation

The upgrader tool will change most files in the codebase. It is important to prepare for this by making sure the project has version control active and ready to support this process. First and foremost, **the codebase must have git version control active**. The tool will stop if it cannot find evidence of git.

### Recommended steps

1. In the terminal, make sure you are in your project root.
2. Confirm that `git status` is clean (no active changes).
3. Make a **new branch** for the upgrade work (e.g., `3.0` or `a3-upgrade`). This will prevent any accidental problems from committing changes in the main branch.

## Linting the A2 codebase

Use the command `apos-code-upgrader lint` to run a linter scan of the A2 code. This will print to the console every required change it can find. This will *not* actually change any code. It is an especially useful step after you run the upgrade process, but it can be useful before to understand what changes to expect.

## Running the code upgrade

1. Type `apos-code-upgrader upgrade` in the project root to have the tool actually convert code to A3's expected structure and syntax. There may be immediate messages printed to the console suggesting next steps.
2. Run the linter command, `apos-code-upgrader lint`, to see any remaining changes that are detected and require manual conversion.
3. Review the changes (before committing them) with `git status` and `git diff HEAD`. Even though files are moved and directories renamed, git will still be able to display line changes for most of them.

### Reset the changes before committing

If you want to undo all the changes made by the tool for any reason, run `apos-code-upgrader reset` in the project root. You must do this *before committing the changes*. This does a simple hard reset with git and will let you start again after reviewing the changes if you desire.

As a last resort you can always switch back to the main git branch and create a new upgrade branch to start over. You did switch off the main branch at the start, didn't you? 🤓
