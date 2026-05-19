import type { Widget } from '../../models/Widget.js'
import { createWidgetView } from
  '../../../schema-components/app/views/createWidgetView.js'

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {
    name: { type: 'text', label: 'Name' },
    // The items list has its own `resource` (Items controller). With a
    // resource attached, the sub-form's Save fires a real PATCH against
    // `/api/items/:id`, and `ResourceMixin.submitResource` sets
    // `parentMeta.reload = true` on the Widget form's route record. No
    // `inlined: true`, so each item edit lives on its own route — that
    //'s what makes the cancel-back navigate `from.path.startsWith(to.path)`
    // and trigger SourceMixin's reload watcher.
    items: {
      type: 'list',
      label: 'Items',
      resource: { path: 'items' },
      creatable: true,
      editable: true,
      form: {
        type: 'form',
        components: {
          label: { type: 'text', label: 'Label' }
        }
      }
    }
  },
  {
    creatable: true,
    columns: { name: { label: 'Name' } }
  }
)
