// tests/e2e/fixtures/models/Task.ts
import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Task {
  id: number
  name: string
  done: boolean
}

export class Task extends Model {
  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true
    },
    done: {
      type: 'boolean'
    }
  }
}
