import type { ModelProperties, ModelRelations } from '@ditojs/server'
import { Model } from '@ditojs/server'

export class Task extends Model {
  declare id: number
  declare name: string
  declare done: boolean

  static override properties: ModelProperties<Task> = {
    name: {
      type: 'string',
      required: true
    },
    done: {
      type: 'boolean'
    }
  }
}

export class Tag extends Model {
  declare id: number
  declare label: string
  declare tasks: Task[]

  static override properties: ModelProperties<Tag> = {
    label: {
      type: 'string',
      required: true
    }
  }

  static override relations: ModelRelations<Tag> = {
    tasks: {
      relation: 'manyToMany' as const,
      from: 'Tag.id',
      to: 'Task.id'
    }
  }
}

export function someHelper() {}
