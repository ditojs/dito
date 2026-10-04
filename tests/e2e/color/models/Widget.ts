import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Widget {
  id: number
  name: string
  color?: string | null
  alphaColor?: string | null
  rgbColor?: Record<string, number> | null
  hslColor?: Record<string, number> | null
  nameColor?: string | null
}

export class Widget extends Model {
  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true
    },
    color: {
      type: 'string',
      nullable: true
    },
    alphaColor: {
      type: 'string',
      nullable: true
    },
    rgbColor: {
      type: 'object',
      nullable: true
    },
    hslColor: {
      type: 'object',
      nullable: true
    },
    nameColor: {
      type: 'string',
      nullable: true
    }
  }
}
