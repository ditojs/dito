import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface DateWidget {
  id: number
  dateBasic: string | null
  dateClearable: string | null
  datePrefix: string | null
  datetimeBasic: string | null
  timeBasic: string | null
  colorBasic: string | null
  colorAlpha: string | null
  colorNoValue: string | null
}

export class DateWidget extends Model {
  static override properties: ModelProperties = {
    dateBasic: { type: 'date', nullable: true },
    dateClearable: { type: 'date', nullable: true },
    datePrefix: { type: 'date', nullable: true },
    datetimeBasic: {
      type: 'datetime', nullable: true
    },
    timeBasic: { type: 'string', nullable: true },
    colorBasic: { type: 'string', nullable: true },
    colorAlpha: { type: 'string', nullable: true },
    colorNoValue: { type: 'string', nullable: true }
  }
}
