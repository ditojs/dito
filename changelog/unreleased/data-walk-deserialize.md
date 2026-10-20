### Behaviour changes

- **admin:** Of several fields that edit the same value, e.g. in two tabs, only the first one with its own `deserializeValue()` converts the value that is loaded, else the first one through its type. Before, each of these fields converted the value in turn, the next one the result of the previous.
