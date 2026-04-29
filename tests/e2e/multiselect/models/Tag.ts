import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Tag {
  id: number
  name: string
}

export class Tag extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }
}
