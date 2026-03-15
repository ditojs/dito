import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface SliderWidget {
  id: number
  sliderBasic: number | null
  sliderNoInput: number | null
  sliderStep: number | null
  sliderRange: number | null
  sliderDecimals: number | null
  progressBasic: number | null
  progressRange: number | null
  progressStep: number | null
  progressNull: number | null
}

export class SliderWidget extends Model {
  static override properties: ModelProperties = {
    sliderBasic: { type: 'integer', nullable: true },
    sliderNoInput: {
      type: 'integer', nullable: true
    },
    sliderStep: { type: 'integer', nullable: true },
    sliderRange: { type: 'integer', nullable: true },
    sliderDecimals: {
      type: 'number', nullable: true
    },
    progressBasic: {
      type: 'integer', nullable: true
    },
    progressRange: {
      type: 'integer', nullable: true
    },
    progressStep: {
      type: 'integer', nullable: true
    },
    progressNull: {
      type: 'integer', nullable: true
    }
  }
}
