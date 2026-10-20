### Behaviour changes

- **server:** Formats accept empty strings, for all API clients, unlike in JSON Schema: `''` passes `format`, e.g. `email`, `uri` or `color`, and emptiness is checked by `required` only, as in the admin. Formats that describe dates and times (`date`, `time`, `date-time`, `iso-time`, `iso-date-time`) and dito's date types still reject `''`. Emptied optional fields with formats save `''`. Custom formats that check empty strings themselves need `validatesEmptyValues: true`, as `required` and `empty` have.
