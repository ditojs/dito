import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Secret {
  id: number
  name: string
}

export class Secret extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }
}
