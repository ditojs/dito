import { defineEntity, p } from '@mikro-orm/core'
import { Track } from './Track.js'

const PlaylistSchema = defineEntity({
  name: 'Playlist',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    tracks: () =>
      p
        .oneToMany(Track)
        .mappedBy(track => track.playlist)
        .orphanRemoval()
        .orderBy({ order: 'asc', id: 'asc' })
  }
})
export class Playlist extends PlaylistSchema.class {}
PlaylistSchema.setClass(Playlist)
