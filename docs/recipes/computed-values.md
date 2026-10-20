# Computed values

An order has lines, each with a book, a quantity and a price. The order form
should show the total, which updates while the user edits the lines, but the
order doesn't store a total, so the admin shouldn't send it.

## Solution

```js
export const orderForm = {
  type: 'form',
  fields: {
    lines: {
      type: 'list',
      creatable: true,
      deletable: true,
      fields: {
        book: {
          type: 'select',
          relate: true,
          width: '1/2',
          options: {
            data: ({ request }) =>
              request({ resource: '/books', cache: 'local' }),
            label: 'title'
          }
        },
        quantity: { type: 'integer', minimum: 1, default: 1, width: '1/4' },
        price: { type: 'number', decimals: 2, prefix: '€', width: '1/4' }
      }
    },
    total: {
      type: 'number',
      decimals: 2,
      prefix: '€',
      readonly: true,
      exclude: true,
      computeValue: ({ item }) => {
        const total = (item.lines ?? []).reduce(
          (sum, { quantity, price }) => sum + quantity * (price ?? 0),
          0
        )
        // `decimals` validates, so round away floating point errors:
        return Math.round(total * 100) / 100
      }
    }
  }
}
```

## Why

`computeValue()` runs again whenever the data that it reads changes, and writes
its result into the data, also with `visible: false`, but not while `if` is
`false`. `exclude: true` leaves the value out of the data sent to the server,
and changes of excluded values don't make the form dirty.

See also: [`computeValue`](../api/admin/schemas.md#fieldschemabase),
[Fields](../guide/admin/fields.md),
[Dirty state](../guide/admin/dirty-state.md).
