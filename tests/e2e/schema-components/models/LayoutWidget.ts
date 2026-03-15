import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

interface SectionNested {
  street: string
  city: string
}

export interface LayoutWidget {
  id: number
  // UI-only component keys (no data backing)
  buttonBasic: never
  submitBasic: never
  buttonDisabled: never
  labelDefault: never
  spacerBasic: never
  sectionLabelled: never
  sectionCollapsible: never
  // Data fields
  sectionNested: SectionNested | null
  sectionDetail: string | null
}

export class LayoutWidget extends Model {
  static override properties: ModelProperties = {
    sectionNested: { type: 'object', nullable: true },
    sectionDetail: { type: 'string', nullable: true }
  }
}
