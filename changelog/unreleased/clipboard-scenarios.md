### Fixes

- **admin:** Pasting without access to the system clipboard, e.g. when the browser denies it, pastes the copied data as the system clipboard holds it: values that `clipboard.copy()` sets to `undefined` are left out, so the form keeps its own values of these fields, as when pasting from the system clipboard.
