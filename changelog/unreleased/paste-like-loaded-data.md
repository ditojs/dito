### Fixes

- **admin:** Pasting into a form replaces its data like loaded data, but keeps the values of its fields that the pasted data lacks, e.g. hidden fields that `clipboard.copy()` leaves out. Values that `computeValue()` derives are derived from the pasted data, e.g. lists that `serializeValue()` stores in other keys of the item, and the form is only edited if the data that it saves changes.
