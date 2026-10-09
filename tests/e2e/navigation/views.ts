import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

const createView = (label: string) =>
  createWidgetView<Widget>(
    'Widget',
    'widgets',
    { name: { type: 'text', label: 'Name' } },
    { label, columns: { name: { label: 'Name' } } }
  )

export const widgets = createView('Widgets')

// A menu that isn't active pops out its items as a sub-menu.
export const catalog = {
  type: 'menu',
  label: 'Catalog',
  items: {
    gadgets: createView('Gadgets'),
    gizmos: createView('Gizmos')
  }
} as const
