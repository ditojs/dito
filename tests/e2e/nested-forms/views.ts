import type { Album } from './models/Album.js'
import { createWidgetView } from '../../utils/views.js'

export const albums = createWidgetView<Album>(
  'Album',
  'albums',
  {},
  {
    columns: { title: { label: 'Title' } },
    form: {
      type: 'form',
      components: {
        title: { type: 'text', label: 'Title' },
        // The tracks are edited in nested forms, which are transient: Their
        // changes only apply to the album's data.
        tracks: {
          type: 'list',
          label: 'Tracks',
          itemLabel: 'title',
          creatable: true,
          editable: true,
          deletable: true,
          form: {
            type: 'form',
            label: 'Track',
            components: {
              title: { type: 'text', label: 'Track Title' },
              length: { type: 'text', label: 'Length' },
              // Replaces the data of the transient form, like actions that
              // load data for an item.
              fillLength: {
                type: 'button',
                text: 'Fill Length',
                events: {
                  click: ({ item, formComponent }) => {
                    formComponent?.setData({ ...item, length: '3:30' })
                  }
                }
              }
            }
          }
        }
      },
      panels: {
        // The panel shares the album's data, and edits its credits in nested
        // forms too.
        people: {
          type: 'panel',
          label: 'People',
          components: {
            credits: {
              type: 'list',
              label: 'Credits',
              itemLabel: 'name',
              creatable: true,
              editable: true,
              form: {
                type: 'form',
                label: 'Credit',
                components: {
                  name: { type: 'text', label: 'Credit Name' },
                  role: { type: 'text', label: 'Role' }
                }
              }
            }
          }
        }
      }
    }
  }
)
