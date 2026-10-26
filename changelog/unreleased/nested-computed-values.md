### Fixes

- **admin:** Pasting a form into itself no longer marks it edited when its lists hold items with computed values of their own, e.g. lists that `computeValue()` converts from stored objects. The computed values of such items are written at once, together with the values that hold them.
