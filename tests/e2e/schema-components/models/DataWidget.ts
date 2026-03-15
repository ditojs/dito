import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface DataWidget {
  id: number
  dataTextBasic: string | null
  hiddenCompute: string | null
  hiddenDefault: string | null
  computedCompute: string | null
}

export class DataWidget extends Model {
  static override properties: ModelProperties = {
    dataTextBasic: { type: 'string', nullable: true },
    hiddenCompute: {
      type: 'string', nullable: true
    },
    hiddenDefault: {
      type: 'string', nullable: true
    },
    computedCompute: {
      type: 'string', nullable: true
    }
  }
}
