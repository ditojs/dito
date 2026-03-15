import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface SelectWidget {
  id: number
  selectString: string | null
  selectLabelValue: string | null
  selectGroupBy: string | null
  selectClearable: string | null
  selectPrefixSuffix: string | null
  multiselectBasic: string | null
  multiselectMultiple: string[] | null
  multiselectSearchable: string[] | null
  multiselectTaggable: string[] | null
  radioVertical: string | null
  radioHorizontal: string | null
  checkboxesVertical: string[] | null
  checkboxesHorizontal: string[] | null
}

export class SelectWidget extends Model {
  static override properties: ModelProperties = {
    selectString: { type: 'string', nullable: true },
    selectLabelValue: {
      type: 'string', nullable: true
    },
    selectGroupBy: { type: 'string', nullable: true },
    selectClearable: {
      type: 'string', nullable: true
    },
    selectPrefixSuffix: {
      type: 'string', nullable: true
    },
    multiselectBasic: {
      type: 'string', nullable: true
    },
    multiselectMultiple: {
      type: 'array', nullable: true,
      items: { type: 'string' }
    },
    multiselectSearchable: {
      type: 'array', nullable: true,
      items: { type: 'string' }
    },
    multiselectTaggable: {
      type: 'array', nullable: true,
      items: { type: 'string' }
    },
    radioVertical: { type: 'string', nullable: true },
    radioHorizontal: {
      type: 'string', nullable: true
    },
    checkboxesVertical: {
      type: 'array', nullable: true,
      items: { type: 'string' }
    },
    checkboxesHorizontal: {
      type: 'array', nullable: true,
      items: { type: 'string' }
    }
  }
}
