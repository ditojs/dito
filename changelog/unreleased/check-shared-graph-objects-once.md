### Fixes

- **server:** Graph writes check each model that the graph repeats only once for graph control properties, which makes large fetched graphs faster to save, and no longer overflows the stack for graphs that refer back to themselves.
