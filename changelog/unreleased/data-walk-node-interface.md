### Behaviour changes

- **admin:** The data of a form follows the rule of validation for which fields are shown, also for the records of computed values and options, the defaults of values that go missing later, and the errors that it gives to fields: a nested section whose fields are all hidden counts as hidden, together with its own value. Before, only the section's own `if` decided there, so errors of the section's value went to the hidden section instead of the validation errors notification.
- **admin:** Validation logs an `if` that throws and treats its field as shown, as the data of a form already did. Before, the error stopped validation.

### Fixes

- **admin:** `context.getErrors()` lists the errors of a value once, also when several fields edit it, e.g. in two tabs.
