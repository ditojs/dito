import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Award {
  title: string
  year?: number | null
}

export interface Designer {
  id: number
  name: string
  email?: string | null
  isFeatured?: boolean
  rank?: number | null
  awards?: Award[]
  address?: { city?: string } | null
}

// The server checks the lengths of names and titles, which the admin doesn't,
// so that its errors are routed to the widgets:
export class Designer extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true, maxLength: 20 },
    email: { type: 'string', format: 'email', nullable: true },
    isFeatured: { type: 'boolean', default: false },
    rank: { type: 'integer', minimum: 1, nullable: true },
    awards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', required: true, maxLength: 12 },
          year: { type: 'integer', nullable: true }
        }
      }
    },
    address: {
      type: 'object',
      nullable: true,
      properties: { city: { type: 'string' } }
    }
  }
}
