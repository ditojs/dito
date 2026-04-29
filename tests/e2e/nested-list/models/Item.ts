import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Item {
  id: number
  widgetId: number
  label: string
}

export class Item extends Model {
  static override properties: ModelProperties = {
    // `widgetId` is nullable in the schema because Dito's graph save sets
    // it on inserted children from the parent relation — the request body
    // doesn't carry it.
    widgetId: { type: 'integer', index: true, nullable: true },
    label: { type: 'string', required: true }
  }
}
