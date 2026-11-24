### Behaviour changes

- **server:** The `order` query parameter only takes the properties of the
  model that clients see, and answers 400 for unknown, `hidden` and `computed`
  ones, as the order told the values of hidden properties, e.g. `hash`.
