import type { Family } from './models/Family.js'
import { createWidgetView } from '../../utils/views.js'

// Like lineto's font families: The shop sets and their cuts are edited in the
// forms of a tree list, which edit the items directly.
export const families = createWidgetView<Family>('name', 'families', {
  name: { type: 'text', label: 'Name' },
  shopSets: {
    type: 'tree-list',
    label: 'Shop Sets',
    itemLabel: 'name',
    orderKey: 'order',
    mutate: true,
    open: false,
    editable: true,
    draggable: true,
    form: {
      type: 'form',
      components: { name: { type: 'text', label: 'Shop Set Name' } }
    },
    children: {
      name: 'cuts',
      itemLabel: 'name',
      orderKey: 'order',
      mutate: true,
      editable: true,
      draggable: true,
      form: {
        type: 'form',
        components: { name: { type: 'text', label: 'Cut Name' } }
      }
    }
  }
})
