### Fixes

- **admin:** The forms of the items of `wide` views are only wide when they are `wide` themselves, as before 6.0. Since 6.0, the hidden view kept the page wide while the form of one of its items showed.

### Internal

- **admin:** Schemas register as wide with `adminContext.setWideSchema()`, and `adminContext.pageClass` is read-only.
