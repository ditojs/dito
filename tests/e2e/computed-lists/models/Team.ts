import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Assignment {
  member: string
  days: number[]
  hours?: number
}

export interface Team {
  id: number
  name: string
  members?: { name: string }[] | null
  rotas?: { numDays?: number; assignments?: Assignment[] }[] | null
}

export class Team extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    members: { type: 'array', nullable: true, items: { type: 'object' } },
    rotas: { type: 'array', nullable: true, items: { type: 'object' } }
  }
}
