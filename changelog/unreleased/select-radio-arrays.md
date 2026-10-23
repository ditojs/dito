### Fixes

- **admin:** `DitoSelectField` and `DitoRadioField` throw for array properties, pointing to `DitoCheckboxesField` and `DitoMultiselectField`. Since 6.0, they set `multiple` for arrays, which they can't show: the stored values were missing, and picking an option stored a single value instead of an array.
