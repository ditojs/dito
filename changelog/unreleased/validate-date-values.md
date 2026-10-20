### Behaviour changes

- **admin:** `date`, `datetime` and `time` fields validate their values, with "must be a valid date": saving fails where code wrote invalid `Date` objects, e.g. `new Date('soon')`, or strings that aren't dates, e.g. times like `'14:30'`, which were sent unchanged and failed on the server for date properties.
