### Behaviour changes

- **router:** Routes with several params in one segment, e.g. `/a/:x-:y`, throw an error when added, like wildcards inside segments. They created a single param named `x-:y` before.
