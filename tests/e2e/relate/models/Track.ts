import type {
  ModelProperties,
  ModelRelations,
  QueryBuilder
} from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Track {
  id: number
  playlistId: number
  title: string
  order: number | null
  nextTrackId?: number | null
  nextTrack?: Track | null
}

export class Track extends Model {
  static override properties: ModelProperties = {
    // Set by the graph save from the parent relation.
    playlistId: { type: 'integer', index: true, nullable: true },
    title: { type: 'string', required: true },
    order: { type: 'integer', nullable: true },
    nextTrackId: { type: 'integer', nullable: true }
  }

  static override relations: ModelRelations = {
    // Relates to another track of the same playlist.
    nextTrack: {
      relation: 'belongsTo',
      from: 'Track.nextTrackId',
      to: 'Track.id'
    }
  }

  static override scopes = {
    ordered: (query: QueryBuilder<Track>) =>
      query.orderBy('order').orderBy('id'),
    // Only selects the id, so that related tracks are fetched as references.
    relate: (query: QueryBuilder<Track>) => query.select('id')
  }
}
