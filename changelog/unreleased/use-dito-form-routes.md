### New

- **admin:** Forms of `useDitoForm()` in pages support lists and trees whose items edit in forms with routes of their own, below the path of the page, e.g. `/upload/sets/0/cuts/1`, also in deep links. Their forms apply their changes to the page's form. Outside of pages, e.g. in dialogs, the lists still need `inlined: true`.

### Behaviour changes

- **admin:** The paths below a page render the page, e.g. `/tools/cache-purge/unknown`, where the admin rendered no view before.
