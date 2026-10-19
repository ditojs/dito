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
