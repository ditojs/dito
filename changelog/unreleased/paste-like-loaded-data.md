### Fixes

- **admin:** Pasting into a form replaces its data like loaded data: values that the item lacks are pasted too, and `computeValue()` derives its values from the pasted ones, e.g. lists that `serializeValue()` stores in other keys of the item.
