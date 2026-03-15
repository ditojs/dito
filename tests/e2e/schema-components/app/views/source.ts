import { createWidgetView } from './createWidgetView.js'
import type { SourceWidget } from '../../models/SourceWidget.js'

export const source = createWidgetView<SourceWidget>(
  'listInlined',
  'source-widgets',
  {
    listInlined: {
      type: 'list',
      label: 'Inlined List',
      components: {
        name: { type: 'text', label: 'Name' }
      },
      creatable: true
    },
    listColumns: {
      type: 'list',
      label: 'Columns List',
      columns: {
        name: { label: 'Name' }
      },
      components: {
        name: { type: 'text', label: 'Name' }
      }
    },
    listDeletable: {
      type: 'list',
      label: 'Deletable List',
      components: {
        name: { type: 'text', label: 'Name' }
      },
      creatable: true,
      deletable: true
    },
    listDraggable: {
      type: 'list',
      label: 'Draggable List',
      components: {
        name: { type: 'text', label: 'Name' }
      },
      creatable: true,
      draggable: true
    },
    listEmpty: {
      type: 'list',
      label: 'Empty List',
      components: {
        name: { type: 'text', label: 'Name' }
      }
    },
    listForm: {
      type: 'list',
      label: 'Single Form List',
      form: {
        type: 'form',
        label: 'Item',
        components: {
          title: { type: 'text', label: 'Title' },
          description: {
            type: 'textarea', label: 'Description'
          }
        }
      },
      inlined: true,
      creatable: true,
      deletable: true
    },
    listForms: {
      type: 'list',
      label: 'Multi-Form List',
      forms: {
        link: {
          type: 'form',
          label: 'Link',
          components: {
            title: { type: 'text', label: 'Title' },
            url: { type: 'text', label: 'URL' }
          }
        },
        note: {
          type: 'form',
          label: 'Note',
          components: {
            body: {
              type: 'textarea', label: 'Body'
            }
          }
        }
      },
      inlined: true,
      creatable: true,
      deletable: true
    },
    objectInline: {
      type: 'object',
      label: 'Inline Object',
      components: {
        key: { type: 'text', label: 'Key' },
        val: { type: 'text', label: 'Value' }
      }
    },
    objectCreatable: {
      type: 'object',
      label: 'Creatable Object',
      components: {
        key: { type: 'text', label: 'Key' }
      },
      creatable: true
    }
  }
)
