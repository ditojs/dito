import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface BooleanWidget {
  id: number
  checkboxBasic: boolean | null
  switchBasic: boolean | null
  switchLabels: boolean | null
}

export class BooleanWidget extends Model {
  static override properties: ModelProperties = {
    checkboxBasic: {
      type: 'boolean', nullable: true
    },
    switchBasic: {
      type: 'boolean', nullable: true
    },
    switchLabels: {
      type: 'boolean', nullable: true
    }
  }
}
