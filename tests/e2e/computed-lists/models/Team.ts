import { defineEntity, p } from '@mikro-orm/core'

export interface Assignment {
  member: string
  days: number[]
  hours?: number
  // Buttons don't hold data of their own, so their keys are `never`.
  notify?: never
}

const TeamSchema = defineEntity({
  name: 'Team',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    members: p.json<{ name: string }[]>().nullable(),
    rotas: p
      .json<{ numDays?: number; assignments?: Assignment[] }[]>()
      .nullable()
  }
})
export class Team extends TeamSchema.class {}
TeamSchema.setClass(Team)
