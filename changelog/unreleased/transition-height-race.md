### Fixes

- **ui:** `TransitionHeight` measures and animates entering elements in the same task instead of across timeouts. Collapsible sections open smoothly again instead of showing only their border for a moment, and no longer keep a fixed height when a busy browser ends the transition early, which squashed opened sections over the ones below them.
