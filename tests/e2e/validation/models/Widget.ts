import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Widget {
  id: number
  name: string
  email: string | null
}

export class Widget extends Model {
  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true,
      minLength: 3
    },
    email: {
      type: 'string',
      format: 'email',
      nullable: true
    }
  }
}
