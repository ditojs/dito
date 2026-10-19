import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'
import nameLayout from './components/name-layout.js'

export const widgets = createWidgetView<Widget>(
  'Widget',
  'widgets',
  {},
  {
    creatable: true,
    columns: { name: { label: 'Name' } },
    form: {
      type: 'form',
      tabs: {
        main: {
          type: 'tab',
          label: 'Main',
          defaultTab: true,
          fields: {
            name: { type: 'text', label: 'Name' }
          }
        },
        details: {
          type: 'tab',
          label: 'Details',
          fields: {
            notes: { type: 'textarea', label: 'Notes' },
            settings: {
              type: 'section',
              label: 'Settings',
              nested: true,
              collapsible: true,
              fields: {
                color: { type: 'text', label: 'Color' }
              }
            },
            links: {
              type: 'list',
              label: 'Links',
              inlined: true,
              collapsible: 'all',
              clipboard: true,
              itemLabel: ({ item }) => ({
                text: 'Link',
                suffix: { html: ` — <small>${item.url}</small>` }
              }),
              form: {
                type: 'form',
                fields: {
                  url: { type: 'url', label: 'URL' },
                  image: {
                    type: 'upload',
                    label: 'Image',
                    thumbnails: 'medium',
                    clipboard: true,
                    deletable: true
                  },
                  // Long labels are clipped with an ellipsis:
                  parts: {
                    type: 'list',
                    label: {
                      html: `Parts <small>${'long '.repeat(100)}</small>`
                    },
                    inlined: true,
                    form: {
                      type: 'form',
                      fields: { name: { type: 'text', label: 'Part Name' } }
                    }
                  }
                }
              }
            }
          }
        }
      },
      panels: {
        info: {
          type: 'panel',
          label: 'Info',
          fields: {
            size: {
              type: 'select',
              label: 'Size',
              options: ['Small', 'Large']
            }
          }
        }
      }
    }
  }
)

export const names = {
  type: 'view',
  label: 'Names',
  fields: {
    name: {
      type: 'section',
      label: 'Name',
      component: nameLayout,
      fields: {
        title: { type: 'text', label: 'Title', width: '1/3' },
        first: { type: 'text', label: 'First', width: '1/2' },
        last: { type: 'text', label: 'Last', width: '1/2' }
      }
    }
  }
} as const
