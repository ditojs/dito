import type { Draft } from './models/Draft.js'
import { createWidgetView } from '../../utils/views.js'

// New drafts receive the defaults of the schema, and of the types without
// one, e.g. `false` for `switch` and empty lists for `checkboxes` and `list`.
export const drafts = createWidgetView<Draft>(
  'Draft',
  'drafts',
  {
    name: { type: 'text', label: 'Name', required: true },
    note: { type: 'text', label: 'Note' },
    title: { type: 'text', label: 'Title', default: 'Untitled' },
    count: { type: 'number', label: 'Count', default: 3 },
    archived: { type: 'checkbox', label: 'Archived' },
    published: { type: 'switch', label: 'Published' },
    size: {
      type: 'select',
      label: 'Size',
      options: ['s', 'm', 'l'],
      default: 'm'
    },
    features: {
      type: 'checkboxes',
      label: 'Features',
      options: ['search', 'export']
    },
    tags: {
      type: 'multiselect',
      label: 'Tags',
      multiple: true,
      options: ['x', 'y'],
      default: ['x']
    },
    priority: {
      type: 'radio',
      label: 'Priority',
      options: ['low', 'high'],
      default: 'low'
    },
    // Defaults can be functions, called with the context of the component.
    code: {
      type: 'text',
      label: 'Code',
      default: ({ name }: { name: string }) => `${name}-default`
    },
    rows: {
      type: 'list',
      label: 'Rows',
      inlined: true,
      creatable: true,
      form: {
        type: 'form',
        components: { label: { type: 'text', label: 'Row Label' } }
      }
    },
    settings: {
      type: 'section',
      label: 'Settings',
      nested: true,
      components: {
        mode: { type: 'text', label: 'Mode', default: 'auto' }
      }
    }
  },
  {
    creatable: true,
    columns: { name: { label: 'Name' } }
  }
)
