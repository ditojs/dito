# Recipes

Short solutions to problems that most Dito.js applications run into. Each
recipe states a problem, shows code that solves it and says in a sentence or
two why it works. All of them use the same example: a bookshop with books,
authors, chapters, genres, orders, customers and reviews.

The recipes assume the basics of the [server guide](../guide/server/index.md)
and the [admin guide](../guide/admin/index.md). Admin code goes into view and
form schemas passed to `new DitoAdmin()`, server code into the models and
controllers passed to `new Application()`.

## Admin

| Recipe | Problem |
| ------ | ------- |
| [Computed values](./computed-values.md) | Show a value derived from others, e.g. an order total, without saving it. |
| [Select from edited items](./select-from-edited-items.md) | Pick one of the items that the same form edits, including new ones. |

## Admin and server

| Recipe | Problem |
| ------ | ------- |
| [Dependent selects](./dependent-selects.md) | Filter books by genre and subgenre, with subgenres loaded for the selected genre. |
| [Ordering by drag](./drag-ordering.md) | Let users reorder items and store the order. |
| [Asking for input](./dialog-input.md) | Ask for input in a dialog and send it to a custom action. |
| [Uploads with thumbnails](./uploads.md) | Upload cover images, store them and show thumbnails. |
| [Roles](./roles.md) | Show views and actions only to users with certain roles. |
| [Editing a graph](./edit-graph.md) | Load and save a book with its author and chapters in one form. |

## Server

| Recipe | Problem |
| ------ | ------- |
| [Timestamps and slugs](./timestamps-slugs.md) | Set `createdAt`, `updatedAt` and derived values automatically. |
