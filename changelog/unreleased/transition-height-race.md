### Fixes

- **ui:** `TransitionHeight` releases the height of entering elements also when a busy browser ends the transition before the height was measured. Before, the elements kept the measured height, which squashed opened sections over the ones below them.
