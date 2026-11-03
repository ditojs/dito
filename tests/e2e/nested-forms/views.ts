import type { EntityDTO } from '@mikro-orm/core'
import type { Album, Credit, Track } from './models/Album.js'
import { createWidgetView } from '../../utils/views.js'

// The JSON columns as the form edits them.
type AlbumItem = Omit<EntityDTO<Album>, 'tracks' | 'credits'> & {
  tracks?: Track[] | null
  credits?: Credit[] | null
}

export const albums = createWidgetView<AlbumItem>(
  'Album',
  'albums',
  {},
  {
    columns: { title: { label: 'Title' } },
    form: {
      type: 'form',
      fields: {
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
            fields: {
              title: { type: 'text', label: 'Track Title' },
              length: { type: 'text', label: 'Length' },
              // Resets the data of the transient form, like actions that load
              // data for an item.
              fillLength: {
                type: 'button',
                text: 'Fill Length',
                onClick: ({ item, resetItem }) => {
                  resetItem({ ...item, length: '3:30' })
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
          fields: {
            credits: {
              type: 'list',
              label: 'Credits',
              itemLabel: 'name',
              creatable: true,
              editable: true,
              form: {
                type: 'form',
                label: 'Credit',
                fields: {
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
