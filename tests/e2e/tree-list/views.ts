import type { Library } from './models/Library.js'
import { createWidgetView } from '../../utils/views.js'

// The shelves and their books are edited in the forms of a tree list, which
// edit the items directly, and reordered by dragging.
export const libraries = createWidgetView<Library>('name', 'libraries', {
  name: { type: 'text', label: 'Name' },
  shelves: {
    type: 'tree-list',
    label: 'Shelves',
    itemLabel: 'name',
    orderKey: 'order',
    mutate: true,
    open: false,
    editable: true,
    draggable: true,
    form: {
      type: 'form',
      components: { name: { type: 'text', label: 'Shelf Name' } }
    },
    children: {
      name: 'books',
      itemLabel: 'name',
      orderKey: 'order',
      mutate: true,
      editable: true,
      deletable: true,
      draggable: true,
      form: {
        type: 'form',
        components: { name: { type: 'text', label: 'Book Title' } }
      }
    }
  },
  // The object shows its properties, and its sections as children.
  catalog: {
    type: 'tree-object',
    label: 'Catalog',
    properties: {
      title: { label: 'Catalog Title' }
    },
    children: {
      name: 'sections',
      itemLabel: 'name'
    }
  }
})
