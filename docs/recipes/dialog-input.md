# Asking for input

Editors add books by their ISBN: the server looks up the book in a catalog and
creates it. The list of books needs an Import button that asks for the ISBN
and the number of copies in stock, sends them to the server and opens the new
book.

## Solution

On the server, a collection action validates its parameters and creates the
book:

```js
export class Books extends ModelController {
  modelClass = Book

  collection = {
    allow: ['get', 'post'],
    'post import': {
      authorize: ['editor', 'admin'],
      parameters: {
        isbn: { type: 'string', required: true, pattern: '^97[89]\\d{10}$' },
        stock: { type: 'integer', minimum: 0, default: 1 }
      },
      async handler(ctx, { isbn, stock }) {
        // `lookUpBook()` stands for your catalog's API:
        const { title, summary } = await lookUpBook(isbn)
        return this.query().insertAndFetch({ isbn, title, summary, stock })
      }
    }
  }

  // Opening the new book needs the member actions:
  member = { allow: ['get', 'patch', 'delete'] }
}
```

In the admin, a button of the list shows the dialog:

```js
export const books = {
  type: 'view',
  field: {
    type: 'list',
    resource: 'books',
    form: bookForm,
    columns: ['title', 'isbn'],
    buttons: {
      import: {
        text: 'Import',
        async onClick(context) {
          const { showDialog, request, navigate } = context
          // Let the button take clicks again while the dialog is open:
          context.isRunning = false
          const data = await showDialog({
            fields: {
              isbn: { type: 'text', label: 'ISBN' },
              stock: { type: 'integer', minimum: 0 }
            },
            buttons: {
              cancel: {},
              import: { type: 'submit', text: 'Import' }
            },
            data: { stock: 1 },
            settings: { label: 'Import Book' }
          })
          if (data) {
            const book = await request({
              method: 'post',
              resource: 'import',
              data
            })
            await navigate(`/books/${book.id}`)
          }
        }
      }
    }
  }
}
```

## Why

`showDialog()` resolves to the dialog's data when its `submit` button is
clicked, and to `undefined` when it's cancelled. `request()` resolves
`resource` relative to the list's resource, here `POST books/import`, whose
`parameters` validate and coerce the body before the handler receives them:
invalid input responds with a 400 `ValidationError`, which rejects the request
and shows as an error notification. The dialog itself doesn't validate on
submit, so the server's `parameters` are where the input is checked.

On `isRunning`, see
[Buttons that wait for a dialog](../guide/admin/buttons.md#buttons-that-wait-for-a-dialog).

See also: [Dialogs](../guide/admin/dialogs.md),
[`showDialog()`](../api/admin/context.md#showdialog),
[Parameters](../api/server/controllers.md#parameters).
