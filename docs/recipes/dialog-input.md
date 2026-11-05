# Asking for input

Editors add books by their ISBN: the server looks up the book in a catalog and
creates it. The list of books needs an Import button that asks for the ISBN
and the number of copies in stock, sends them to the server and opens the new
book.

## Solution

On the server, a custom action validates its body and creates the book:

```js
import { defineAction } from '@ditojs/server'
import { createRecord, defineModelController } from '@ditojs/mikro'
import { z } from 'zod'

export const books = defineModelController({
  path: 'books',
  entity: Book,
  authorize: ['editor', 'admin'],
  actions: {
    'get': true,
    'post': true,
    // Opening the new book needs the member actions.
    'get :id': true,
    'patch :id': true,
    'delete :id': true,
    'post import': defineAction({
      body: z.object({
        isbn: z.string().regex(/^97[89]\d{10}$/),
        stock: z.int().min(0).default(1)
      }),
      async handler({ body: { isbn, stock }, db }) {
        // `lookUpBook()` stands for your catalog's API.
        const { title, summary } = await lookUpBook(isbn)
        return createRecord(db, Book, {
          isbn,
          title,
          summary,
          stock
        })
      }
    })
  }
})
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
`resource` relative to the list's resource, here `POST books/import`.

The action's `body` schema validates the data and sets its defaults before the
handler runs. Invalid input responds with 400 and the errors of each field. This
rejects the request, and the admin shows an error notification. The dialog
doesn't validate on submit, so the action's schema checks the input.

`createRecord()` runs the checks of a body on the data and creates the book. The
controller flushes it after the handler, and sends the book with the new `id`,
in the shape of its `find`.

On `isRunning`, see
[Buttons that wait for a dialog](../guide/admin/buttons.md#buttons-that-wait-for-a-dialog).

See also: [Dialogs](../guide/admin/dialogs.md),
[`showDialog()`](../api/admin/context.md#showdialog),
[Query and body schemas](../guide/server/controllers.md#query-and-body-schemas),
[Writes in custom handlers](../guide/server/writes.md#writes-in-custom-handlers).
