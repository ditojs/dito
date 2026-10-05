import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

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

export interface Album {
  id: number
  title: string
  tracks?: Track[] | null
  credits?: Credit[] | null
}

export class Album extends Model {
  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    tracks: { type: 'array', nullable: true, items: { type: 'object' } },
    credits: { type: 'array', nullable: true, items: { type: 'object' } }
  }
}
