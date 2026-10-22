### Behaviour changes

- **admin:** Views keep their components mounted, hidden, while the form of an item is open, as forms do for their nested forms, so their sources claim the routes of the forms like all other sources. Views route the forms of sources in the items of their inlined lists, e.g. `/admin/books/books/1/chapters/0`, and the forms of the items of trees in views render beside the tree.
- **admin:** Hidden sources load their data once they're shown, so deep links into the form of an item don't load the list, which opens the item by its id. Lists don't load again when the forms of their items close, unless a form saved an item.
- **admin:** Lists take their query back into the URL when the forms of their items close, e.g. `/admin/books?page=2`, in views and in forms.
