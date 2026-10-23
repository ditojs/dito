### Fixes

- **server:** References in `anyOf` and `oneOf` reject unknown properties again, as in 3.5, also in nullable properties like `anyOf: [{ type: 'null' }, { $ref: '#Cat' }]`. Next to a discriminator or properties of their own, the outer object rejects them instead.
