### Fixes

- **admin:** The validation notification lists the errors of fields that aren't visible, like `value` fields without `visible: true` and fields in sections or panels with `visible: false`, with their messages. Before, it only asked to correct the highlighted errors, with nothing highlighted.
