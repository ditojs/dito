import type { ModelProperties, QueryBuilder } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Contact {
  name: string
  email?: string | null
}

export interface Milestone {
  title: string
  due?: string | null
}

export interface Phase {
  name: string
  tasks?: { name: string }[]
}

export interface Project {
  id: number
  name: string
  description?: string | null
  budget?: number | null
  status?: string | null
  tags?: string[] | null
  priority?: string | null
  features?: string[] | null
  active?: boolean | null
  archived?: boolean | null
  progress?: number | null
  color?: string | null
  startDate?: string | null
  notes?: string | null
  config?: string | null
  contacts?: Contact[] | null
  milestones?: Milestone[] | null
  phases?: Phase[] | null
  settings?: { visibility?: string | null; reviewer?: string | null } | null
  advanced?: { slug?: string | null } | null
  // Buttons and labels don't hold data of their own, so their keys are
  // `never`.
  openDialog?: never
  owner?: never
}

export class Project extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    description: { type: 'text', nullable: true },
    budget: { type: 'number', nullable: true },
    status: { type: 'string', nullable: true },
    tags: { type: 'array', nullable: true, items: { type: 'string' } },
    priority: { type: 'string', nullable: true },
    features: { type: 'array', nullable: true, items: { type: 'string' } },
    active: { type: 'boolean', nullable: true },
    archived: { type: 'boolean', nullable: true },
    progress: { type: 'number', nullable: true },
    color: { type: 'string', nullable: true },
    startDate: { type: 'date', nullable: true },
    notes: { type: 'text', nullable: true },
    config: { type: 'text', nullable: true },
    contacts: { type: 'array', nullable: true, items: { type: 'object' } },
    milestones: { type: 'array', nullable: true, items: { type: 'object' } },
    phases: { type: 'array', nullable: true, items: { type: 'object' } },
    settings: { type: 'object', nullable: true },
    advanced: { type: 'object', nullable: true }
  }

  static override scopes = {
    planned: (query: QueryBuilder<Project>) => query.where('status', 'Planned'),
    active: (query: QueryBuilder<Project>) => query.where('status', 'Active'),
    done: (query: QueryBuilder<Project>) => query.where('status', 'Done')
  }

  static override filters = {
    search(query: QueryBuilder<Project>, search: string) {
      query.whereILike('name', `%${search}%`)
    }
  }
}
