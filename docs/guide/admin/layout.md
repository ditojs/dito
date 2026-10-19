# Layout

Components are laid out in lines, in the order of `components`. Sections group
them, tabs split a form into pages, and panels add boxes to the sidebar.

## Widths and lines

Each component takes the full width of the line unless it sets `width`. A line
holds components until their widths exceed it:

```js
components: {
  title: { type: 'text' },
  price: { type: 'number', width: '1/3' },
  isAvailable: { type: 'switch', width: '1/6' },
  stock: { type: 'integer', width: '1/2' },
  isbn: { type: 'text', width: '1/2', break: 'before' }
}
```

`width` takes fractions (`'1/3'`, `0.5`), percentages (`'20%'`), `'auto'` for
the width of the content, `'fill'` for the space left in the line, and widths
that grow or shrink to fit the line (`'>30%'`, `'<30%'`). `break` forces a new
line before or after the component. See
[Layout options](../../api/admin/schemas.md#layout-options).

Components sit at the top of their line. `align` places them at its
`'center'` or `'bottom'` instead, e.g. a switch next to a textarea:

```js
components: {
  summary: { type: 'textarea', lines: 4, width: '3/4' },
  isFeatured: { type: 'switch', width: '1/4', align: 'bottom' }
}
```

## Sections

A section groups components under a header:

```js
sales: {
  type: 'section',
  label: 'Sales',
  collapsible: true,
  collapsed: ({ item }) => item.isArchived,
  components: {
    price: { type: 'number', decimals: 2, width: '1/2' },
    stock: { type: 'integer', width: '1/2' }
  },
  onToggle({ collapsed }) {
    console.log(`Sales ${collapsed ? 'collapsed' : 'expanded'}`)
  }
}
```

By default a section has no value of its own: its components edit the item of
the form, here `item.price` and `item.stock`. With `nested: true`, they edit
an object stored under the section's name. In the customer form:

```js
shippingAddress: {
  type: 'section',
  label: 'Shipping Address',
  nested: true, // Edits `item.shippingAddress.street`, …
  components: {
    street: { type: 'text' },
    city: { type: 'text', width: '1/2' },
    country: { type: 'text', width: '1/2' }
  }
}
```

The section's callbacks and events then describe that object: `item` is
`item.shippingAddress` and `parentItem` the customer, see
[The context](./context.md#which-item-a-context-describes).

Only sections and [panels](#panels) take `nested`; other types throw for it.
The `components` of sections can be a callback, like those of forms, see
[Forms](./forms.md#components-that-depend-on-the-data).

`clipboard: true` on a section copies and pastes its data, see
[Clipboard](./forms.md#clipboard).

## Tabs

`tabs` splits a view, form or section into tabs, each with its own components:

```js
export const book = {
  type: 'form',
  tabs: {
    content: {
      type: 'tab',
      label: 'Content',
      components: {
        title: { type: 'text' },
        summary: { type: 'textarea' }
      }
    },
    sales: {
      type: 'tab',
      label: 'Sales',
      defaultTab: ({ item }) => !!item.publishedAt,
      components: {
        price: { type: 'number' },
        stock: { type: 'integer' }
      }
    }
  }
}
```

The first tab is selected unless one sets `defaultTab`. The tab of a form or
view is part of its URL, so reloads and links keep it. Tabs render once they
are selected and stay rendered, and all their data is validated and saved, also
of tabs that were never opened. In forms, `context.selectedTab` names the
selected tab.

## Panels

Panels are boxes in the sidebar, given in `panels` of any schema:

```js
export const book = {
  type: 'form',
  components: { … },
  panels: {
    statistics: {
      type: 'panel',
      label: 'Statistics',
      sticky: true,
      components: {
        wordCount: {
          type: 'value',
          visible: true,
          exclude: true,
          computeValue: ({ item }) => item.summary?.split(/\s+/).length ?? 0
        }
      }
    }
  }
}
```

A panel edits the item around it. With `nested: true`, like a section, it
edits an object stored under its name: a panel `shippingAddress` in the
customer form edits `item.shippingAddress`.

With its own `data`, a panel's components edit that data instead, which isn't
saved with the form and doesn't make it dirty:

```js
panels: {
  discount: {
    type: 'panel',
    label: 'Discount',
    data: { percent: 10 },
    components: {
      percent: { type: 'integer', suffix: '%' },
      apply: {
        type: 'button',
        text: 'Apply Discount',
        // Writes to the page's data are edits of the book:
        onClick({ item, rootItem }) {
          rootItem.price *= 1 - item.percent / 100
        }
      }
    }
  }
}
```

Inside such a panel, `item` is the panel's data and `rootItem` the data of the
page, in all callbacks of its components, e.g. also in their `if` and while
the page validates. Writes through `rootItem` or `parentItem` change the page's data, and
count as edits of it, see [Dirty state](./dirty-state.md). The filters of
lists are a panel of this kind. Panels with their own `data` can't be nested:
`nested: true` throws for them.

## Labels and spacers

`label` shows text in the place of a component, and `spacer` leaves a gap:

```js
notice: { type: 'label', label: 'Prices include VAT.' },
gap: { type: 'spacer', width: '1/3' }
```

## Compact and wide

`compact: true` reduces the spacing of a view, form or section, and
`wide: true` widens the content area of views and forms.

## Menu and sidebar

The navigation menu and the sidebar with the panels are docked next to the
content on wide screens. The buttons at both ends of the header collapse them,
which the browser remembers. On screens narrower than 1200px, the sidebar
hides, and below 800px, the menu does too. The buttons then open them above
the content, until a click outside, Escape or navigation closes them.

## Reference

- [Layout schemas](../../api/admin/schemas.md#layout): `section`, `panel`,
  `label`, `spacer`, buttons.
- [Tabs](../../api/admin/schemas.md#tabs).
