import { defineEntity, p } from '@mikro-orm/core'
import { Playlist } from './Playlist.js'

const TrackSchema = defineEntity({
  name: 'Track',
  properties: {
    id: p.integer().primary(),
    playlist: () => p.manyToOne(Playlist).nullable(),
    title: p.string(),
    order: p.integer().nullable(),
    // Relates to another track of the same playlist.
    nextTrack: () => p.manyToOne(Track).nullable().deleteRule('set null')
  }
})
export class Track extends TrackSchema.class {}
TrackSchema.setClass(Track)
