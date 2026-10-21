### New

- **utils:** The `html` tagged template creates HTML that the admin renders as HTML: it escapes the values that it includes, except other `html` values, joins arrays and skips `null`, `undefined` and `false`. `isHtml()` recognizes its values.
- **admin:** Labels, item labels, info, affixes, the results of `render()`, the messages of `confirm()`, `prompt()` and `alert()`, and the paragraphs of `notify()` take `html` values, also as `text` of label objects, affixes and `notify()`.

### Behaviour changes

- **admin:** The strings that `render()` of columns, lists, objects and uploads returns, and the messages of `confirm()`, `prompt()` and `alert()`, show as text, escaped, so data in them can't inject HTML. Before, they were rendered as HTML. Callbacks that return HTML need to create it with `html` of `@ditojs/utils`, e.g. ``render: ({ value }) => html`<b>${value}</b>` ``.
