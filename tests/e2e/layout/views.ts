import type { Widget } from './models/Widget.js'
import { createWidgetView } from '../../utils/views.js'

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
          components: {
            name: { type: 'text', label: 'Name' }
          }
        },
        details: {
          type: 'tab',
          label: 'Details',
          components: {
            notes: { type: 'textarea', label: 'Notes' },
            settings: {
              type: 'section',
              label: 'Settings',
              nested: true,
              collapsible: true,
              components: {
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
                components: {
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
                      components: { name: { type: 'text', label: 'Part Name' } }
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
          components: {
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
