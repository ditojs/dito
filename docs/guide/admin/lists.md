# Lists and Objects

Lists and objects hold items that are edited with forms. Together they are
called sources:

- `list` holds an array of items, shown as a table.
- `object` holds one item, e.g. the address of a customer.
- `tree-list` and `tree-object` hold items with children, shown as a tree.

A source either loads its items from its own `resource`, or edits items that
are part of the data around it, e.g. the chapters stored with a book.

## Lists with a resource

```js
books: {
  type: 'list',
  resource: 'books',
  columns: {
    title: { sortable: true, defaultSort: 'asc' },
    author: {
      render: ({ value }) => escapeHtml(value?.name ?? '')
    },
    price: { sortable: true }
  },
  paginate: 50,
  creatable: true,
  editable: true,
  deletable: true,
  form: () => import('../forms/book.js')
}
```

The list loads `GET books` with the query of its page, order, scope and
filters, and keeps that query in the URL, so a reload or a shared link shows
the same page. Its forms load, save and delete their items themselves.

- `columns` lists the keys to show, or maps them to column options. `render()`
  returns HTML, so escape item values with `escapeHtml()` from
  `@ditojs/utils`. Without `render()`, cells show values as their types display
  them, e.g. dates formatted.
- `sortable` columns sort through the `order` of the query, which the server's
  model controllers understand.
- `paginate` sets the page size. Without it, the list shows all items.
- `creatable`, `editable` and `deletable` add the buttons for these actions.
  They take callbacks too, e.g.
  `deletable: ({ user }) => user.hasRole('admin')`.

Sources with their own resource are excluded from the data of the form around
them: their changes are saved through their own requests, not with the form.

## Item labels

`itemLabel` sets how items are named in lists without columns, delete
confirmations and notifications. A string names the key to show, a
callback returns text, or HTML as `{ html }`, see
[Text and HTML](../../api/admin/schemas.md#text-and-html):

```js
itemLabel: ({ item }) => `${item.title} (${item.isbn})`
```

Without `itemLabel`, the first column is used, else the item's `name`. Inside
the item's form, every callback can read the label as `context.itemLabel`, see
[The context](./context.md#the-label-of-the-item).

## Scopes and filters

`scopes` adds buttons that switch between the model scopes of the server, and
`filters` adds a filter panel to the sidebar, whose values are sent as the
`filter` query parameter:

```js
books: {
  type: 'list',
  resource: 'books',
  scopes: {
    all: { label: 'All' },
    published: { label: 'Published', defaultScope: true }
  },
  filters: {
    title: { filter: 'text', operators: ['contains', 'starts-with'] },
    publishedAt: { filter: 'date-range' }
  },
  columns: ['title', 'publishedAt']
}
```

The model needs the matching scopes and filters, see
[Queries](../server/queries.md). Changing a filter goes back to the first
page.

## Items in the data

Without a `resource`, a list edits an array in the data of its form. Its items
are saved with the form:

```js
chapters: {
  type: 'list',
  inlined: true,
  draggable: true,
  orderKey: 'position',
  creatable: true,
  deletable: true,
  collapsible: true,
  itemLabel: ({ item }) => item.title || 'Untitled',
  components: {
    title: { type: 'text' },
    text: { type: 'markup', marks: { bold: true, italic: true } }
  }
}
```

- `inlined: true`, or `components` instead of `form`, edits each item right
  in the list. `collapsible` and `collapsed` let users fold the items.
- Without `inlined`, the list opens a form for each item on a page of its own.
  These are [nested forms](./nested-forms.md): they edit a draft of the item,
  which their Apply button applies to the data of the parent form.
- `draggable` lets users reorder the items. `orderKey` stores each item's
  position in that key, e.g. for the server to sort by.

## Objects

An `object` holds a single item, edited inline or in a form of its own:

```js
shippingAddress: {
  type: 'object',
  label: 'Shipping Address',
  components: {
    street: { type: 'text' },
    city: { type: 'text', width: '1/2' },
    country: { type: 'text', width: '1/2' }
  }
}
```

An object is `null` until it's created: with `creatable`, a button creates it.
A list is never `null`: a stored `null` loads as its `default`, or `[]`.
Use a [section](./layout.md#sections) with `nested: true` instead, for an
object that always exists.

## Several kinds of items

`forms` picks the form by the item's `type`, and the create button offers each
form:

```js
blocks: {
  type: 'list',
  inlined: true,
  creatable: true,
  draggable: true,
  forms: {
    text: {
      type: 'form',
      label: 'Text',
      components: { text: { type: 'markup' } }
    },
    quote: {
      type: 'form',
      label: 'Quote',
      components: {
        quote: { type: 'textarea' },
        source: { type: 'text' }
      }
    }
  }
}
```

The create menu reads only the `creatable` and `disabled` of each form:
`creatable: false` leaves a form out, `disabled: true` greys it out, or
disables the create button of a list with a single form. A form's
`if` and `visible` don't affect the menu. A `creatable` callback receives the
context of the list, with `item` the item that holds the list and `value` the
list itself, e.g. to allow only one quote:

```js
quote: {
  type: 'form',
  label: 'Quote',
  creatable: ({ value }) => !value.some(block => block.type === 'quote'),
  components: { … }
}
```

## Editing in another view

`view` edits the items in the form of another view, e.g. the books of an
author in the books view. Editing navigates there:

```js
// In the author form:
books: {
  type: 'list',
  view: 'books',
  columns: ['title'],
  editable: true
}
```

## Trees

`tree-list` and `tree-object` show items with children, e.g. genres with
subgenres. `children` describes the children of each level, and nests to any
depth. The forms of tree items are shown next to the tree:

```js
genres: {
  type: 'tree-list',
  form: () => import('../forms/genre.js'),
  editable: true,
  draggable: true,
  collapsed: ({ item }) => !item.children?.length,
  children: {
    name: 'children',
    form: () => import('../forms/genre.js'),
    editable: true,
    draggable: true
  },
  onToggle({ item, collapsed }) {
    console.log(`${item.name} ${collapsed ? 'collapsed' : 'expanded'}`)
  }
}
```

Tree items are collapsed unless `collapsed` returns `false` for them. Each level
reads `collapsed` and `onToggle()` from its own schema: here the tree's schema
for the genres, and `children` for the subgenres.

## Reference

- [Lists and objects](../../api/admin/schemas.md#lists-and-objects): all source options,
  columns, filters and trees.
- [Forms](./forms.md) for the forms that edit the items.
