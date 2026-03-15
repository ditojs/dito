import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

interface ListItem {
  name: string
}

interface FormItem {
  title: string
  description: string
}

interface FormsItem {
  type: string
  title?: string
  url?: string
  body?: string
}

export interface SourceWidget {
  id: number
  listInlined: ListItem[] | null
  listColumns: ListItem[] | null
  listDeletable: ListItem[] | null
  listDraggable: ListItem[] | null
  listEmpty: ListItem[] | null
  listForm: FormItem[] | null
  listForms: FormsItem[] | null
  objectInline: Record<string, string> | null
  objectCreatable: Record<string, string> | null
}

export class SourceWidget extends Model {
  static override properties: ModelProperties = {
    listInlined: {
      type: 'array', nullable: true,
      items: { type: 'object' }
    },
    listColumns: {
      type: 'array', nullable: true,
      items: { type: 'object' }
    },
    listDeletable: {
      type: 'array', nullable: true,
      items: { type: 'object' }
    },
    listDraggable: {
      type: 'array', nullable: true,
      items: { type: 'object' }
    },
    listEmpty: {
      type: 'array', nullable: true,
      items: { type: 'object' }
    },
    listForm: {
      type: 'array', nullable: true,
      items: { type: 'object' }
    },
    listForms: {
      type: 'array', nullable: true,
      items: { type: 'object' }
    },
    objectInline: { type: 'object', nullable: true },
    objectCreatable: {
      type: 'object', nullable: true
    }
  }
}
