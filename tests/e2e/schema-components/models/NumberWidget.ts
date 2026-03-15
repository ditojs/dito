import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface NumberWidget {
  id: number
  numberBasic: number | null
  numberMinMax: number | null
  numberRange: number | null
  numberStep: number | null
  numberStepClearable: number | null
  numberStepFractional: number | null
  numberDecimals: number | null
  numberPrefixSuffix: number | null
  integerBasic: number | null
  integerStep: number | null
  integerMinMaxRounding: number | null
}

export class NumberWidget extends Model {
  static override properties: ModelProperties = {
    numberBasic: { type: 'number', nullable: true },
    numberMinMax: { type: 'number', nullable: true },
    numberRange: { type: 'number', nullable: true },
    numberStep: { type: 'number', nullable: true },
    numberStepClearable: {
      type: 'number', nullable: true
    },
    numberStepFractional: {
      type: 'number', nullable: true
    },
    numberDecimals: { type: 'number', nullable: true },
    numberPrefixSuffix: {
      type: 'number', nullable: true
    },
    integerBasic: { type: 'integer', nullable: true },
    integerStep: { type: 'integer', nullable: true },
    integerMinMaxRounding: {
      type: 'integer', nullable: true
    }
  }
}
