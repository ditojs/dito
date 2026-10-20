### Behaviour changes

- **admin:** Of several fields that edit the same value, e.g. in two tabs, the first one with its own `serializeValue()` serializes the value that is sent, else the first one through its type. Before, the last field did, on the value as it was before the other fields serialized it.
- **admin:** Items edited by several fields of the same value with different forms are sent with the values of all these forms. Before, only the values of the last field's form were sent.
