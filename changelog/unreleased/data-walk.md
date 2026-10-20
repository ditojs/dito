### Behaviour changes

- **admin:** Several fields that edit the same value, e.g. in two tabs, are all validated, and their errors are collected, each message once. Before, the errors of the last field replaced those of the others. New items and data get the default of the first of these fields that has its own `default`. Before, the first field set its type's default, e.g. `''`, and later fields' `default` was ignored.
