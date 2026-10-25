# Unreleased changes

Each pull request adds its changelog entries here, in a file of its own named
after its branch, e.g. `context-get-value-at.md`, under the headings of their
kind in the format of [`CHANGELOG.md`](../../CHANGELOG.md):

```md
### New

- **admin:** `context.getValueAt(dataPath)` reads values relative to the item.
```

The kinds are `Behaviour changes`, `Deprecations`, `New`, `Fixes` and
`Internal`. On release, `scripts/changelog.js` collects the files into the
section of the new version and deletes them, so that pull requests don't
conflict in `CHANGELOG.md`.

## Writing entries

Entries are read by the people who upgrade apps, so keep them short:

- One or two sentences per entry: what changed for apps, and what to do about
  it. Link the docs or the upgrade guide for details, instead of describing
  edge cases or how the code works.
- Name the option, method or class that changed, e.g. `nullable: false` or
  `ctx.login()`.
- Changes of the same topic can share one entry, with sub-items.
