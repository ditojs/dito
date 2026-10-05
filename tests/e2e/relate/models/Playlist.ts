import type {
  ModelProperties,
  ModelRelations,
  QueryBuilder
} from '@ditojs/server'
import { Model } from '@ditojs/server'
import { Track } from './Track.js'

export interface Playlist {
  id: number
  name: string
  tracks?: Track[]
}

export class Playlist extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }

  static override relations: ModelRelations = {
    tracks: {
      relation: 'hasMany',
      from: 'Playlist.id',
      to: 'Track.playlistId',
      owner: true,
      scope: 'ordered'
    }
  }

  static override scopes = {
    // Fetches the next tracks as references, `{ id }`, which the admin
    // replaces with their options.
    withTracks: (query: QueryBuilder<Playlist>) =>
      query.withGraphFetched('tracks.nextTrack(relate)')
  }
}
