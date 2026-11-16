### Behaviour changes

- **admin:** `date`, `datetime` and `time` fields are built on `reka-ui`'s `DatePicker` and `TimeField`. They edit each part of the value on its own, in the order of `api.locale`, e.g. `5/14/2026`, instead of free text in the display format. The calendar opens with the button next to the field, and its header picks the month and year from lists. `time` fields have no popup.
  - `formats` still formats the display values, e.g. in lists. The fields only take the parts of the time and `hour12` from it, e.g. `{ time: { second: false } }`.
  - `@internationalized/date` is a new peer dependency of `@ditojs/admin` and `@ditojs/ui`, and `reka-ui` one of `@ditojs/ui`.
- **admin:** Color fields open their picker with the swatch button next to the input instead of on focus of the input, built on `reka-ui`'s `Popover`. The swatch always shows, also without a value.
- **ui:** `DitoDatePicker` is rebuilt on `reka-ui`'s `DatePicker`, with dates of `@internationalized/date` as values and the props of `reka-ui`, see [`DitoDatePicker`](docs/api/ui.md#ditodatepicker). `DitoTimeInput` replaces `DitoTimePicker`. `DitoCalendar`, `DitoDateTimePicker` and the helpers `describeDate()`, `alterDate()`, `stepDate()`, `parseDate()`, `getDatePartAtPosition()`, `getSelection()` and `setSelection()` are removed.
