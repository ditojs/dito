import { defineEntity, p } from '@mikro-orm/core'
import { defineJsonType } from '@ditojs/mikro'
import { z } from 'zod'

export interface Chapter {
  type: 'section' | 'bundle'
  name?: string
  title?: string
  discount?: number
}

const VolumeSchema = defineEntity({
  name: 'Volume',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    prices: p
      .type(defineJsonType({ schema: z.array(z.number().min(0)) }))
      .nullable(),
    chapters: p.json<Chapter[]>().nullable()
  }
})
export class Volume extends VolumeSchema.class {}
VolumeSchema.setClass(Volume)
