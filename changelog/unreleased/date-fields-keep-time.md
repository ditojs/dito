### Fixes

- **admin:** `date` fields on timestamp columns keep the time of their values when saving, instead of sending plain dates that dropped it since 3.0. Values without a time of day are still sent as plain dates.
- **ui:** The calendar's today button keeps the time of the value, like selecting today's day does, so that `date` fields send plain dates for it.
