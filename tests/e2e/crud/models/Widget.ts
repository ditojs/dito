import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Widget {
  id: number
  name: string
}

export class Widget extends Model {
  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true
    }
  }
}
