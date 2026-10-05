import type { Playlist } from './models/Playlist.js'
import type { Track } from './models/Track.js'
import { createWidgetView } from '../../utils/views.js'

// `nextTrackTitle` is only displayed, not stored.
type TrackItem = Track & { nextTrackTitle?: string | null }
type PlaylistItem = Omit<Playlist, 'tracks'> & { tracks?: TrackItem[] }

export const playlists = createWidgetView<PlaylistItem>(
  'Playlist',
  'playlists',
  {
    name: { type: 'text', label: 'Name' },
    tracks: {
      type: 'list',
      label: 'Tracks',
      orderKey: 'order',
      inlined: true,
      creatable: true,
      deletable: true,
      form: {
        type: 'form',
        components: {
          title: { type: 'text', label: 'Title' },
          // Relates to a track of the playlist's tracks in the edited data,
          // including new ones that aren't saved yet.
          nextTrack: {
            type: 'select',
            label: 'Next Track',
            relate: true,
            clearable: true,
            options: {
              dataPath: '../..',
              label: 'title'
            }
          },
          // Displays data of the related track, which is only available once
          // its reference is replaced with its option.
          nextTrackTitle: {
            type: 'text',
            label: 'Next Track Title',
            disabled: true,
            exclude: true,
            compute: ({ item }) => item.nextTrack?.title ?? null
          }
        }
      }
    }
  },
  {
    creatable: true,
    columns: { name: { label: 'Name' } }
  }
)
