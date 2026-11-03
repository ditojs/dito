import { defineEntity, p } from '@mikro-orm/core'

export interface Track {
  title: string
  length?: string | null
  // Buttons don't hold data of their own, so their keys are `never`.
  fillLength?: never
}

export interface Credit {
  name: string
  role?: string | null
}

const AlbumSchema = defineEntity({
  name: 'Album',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    tracks: p.json<Track[]>().nullable(),
    credits: p.json<Credit[]>().nullable()
  }
})
export class Album extends AlbumSchema.class {}
AlbumSchema.setClass(Album)
