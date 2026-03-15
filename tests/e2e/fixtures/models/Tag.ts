// tests/e2e/fixtures/models/Tag.ts
import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'
import { Task } from './Task.js'

export class Tag extends Model {
  static override properties: ModelProperties = {
    label: {
      type: 'string',
      required: true
    }
  }

  static override relations = {
    tasks: {
      relation: 'manyToMany' as const,
      from: 'Tag.id',
      to: 'Task.id'
    }
  }
}
