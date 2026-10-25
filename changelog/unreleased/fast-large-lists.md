### Fixes

- **admin:** Large lists open faster:
  - Items of lists and objects that declare their `fields` without a `form`, or that pass on their `clipboard`, no longer render again with each render of their list.
  - Adding an item to a list no longer renders the fields of the other items again.
  - The styles of inputs with affixes and of draggable lists no longer slow down the browser on pages with many inputs.
