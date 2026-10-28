### Fixes

- **server:** Controller hooks that a base class defines in its `hooks` run once per event in subclasses, instead of once for each class between them.
