import type { Playlist } from './models/Playlist.js'
import type { Track } from './models/Track.js'
import { createWidgetView } from '../../utils/views.js'

// `nextTrackTitle` is only displayed, not stored.
type TrackItem = Track & { nextTrackTitle?: string | null }
type PlaylistItem = Omit<Playlist, 'tracks'> & {
  tracks?: TrackItem[]
  editFirstTrack: never
}

const playlists = createWidgetView<PlaylistItem>(
  'Playlist',
  'playlists',
  {
    name: { type: 'text', label: 'Name' },
    // Opens the form of another view, which replaces this form.
    editFirstTrack: {
      type: 'button',
      text: 'Edit First Track',
      events: {
        click: async ({ item, navigate }) => {
          await navigate(`/library/tracks/${item.tracks?.[0]?.id}`)
        }
      }
    },
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

// `initial` is only displayed, not stored.
const tracks = createWidgetView<Track & { initial?: string | null }>(
  'Track',
  'tracks',
  {
    title: { type: 'text', label: 'Title' },
    // Relies on the data of tracks, which the playlist form that navigates
    // here doesn't have.
    initial: {
      type: 'text',
      label: 'Initial',
      if: ({ item }) => item.title.length > 0,
      disabled: true,
      exclude: true,
      compute: ({ item }) => item.title.charAt(0)
    }
  },
  {
    // Loaded items are numbered by their order key, with the offset of the
    // loaded page, see `SourceMixin.setLoadedListItems()`.
    orderKey: 'order',
    paginate: 2,
    columns: { title: { label: 'Title' }, order: { label: 'Order' } }
  }
)

// The views are in separate menus, which add their own route level, like in
// lineto's admin, so that the playlist form and the track form are rendered at
// the same route level.
export const music = {
  type: 'menu',
  label: 'Music',
  items: { playlists }
} as const

export const library = {
  type: 'menu',
  label: 'Library',
  items: { tracks }
} as const
