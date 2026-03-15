import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface TextWidget {
  id: number
  // Shared base config test fields
  textReadonly: string | null
  textDisabled: string | null
  textClearable: string | null
  textPlaceholder: string | null
  textRequired: string | null
  textInfo: string | null
  textWidthAuto: string | null
  textWidthFill: string | null
  textWidthHalf: string | null
  textWidthThird: string | null
  textLabelFalse: string | null
  textPrefix: string | null
  textSuffix: string | null
  textDefault: string | null
  textCompute: string | null
  textComputeSource: string | null
  textFormat: string | null
  textParse: string | null
  textProcess: string | null
  // Text subtype test fields
  textBasic: string | null
  textEmail: string | null
  textUrl: string | null
  textHostname: string | null
  textDomain: string | null
  textTel: string | null
  textPassword: string | null
  textCreditcard: string | null
  textTrim: string | null
}

export class TextWidget extends Model {
  static override properties: ModelProperties = {
    textReadonly: { type: 'string', nullable: true },
    textDisabled: { type: 'string', nullable: true },
    textClearable: { type: 'string', nullable: true },
    textPlaceholder: { type: 'string', nullable: true },
    textRequired: { type: 'string', nullable: true },
    textInfo: { type: 'string', nullable: true },
    textWidthAuto: { type: 'string', nullable: true },
    textWidthFill: { type: 'string', nullable: true },
    textWidthHalf: { type: 'string', nullable: true },
    textWidthThird: { type: 'string', nullable: true },
    textLabelFalse: { type: 'string', nullable: true },
    textPrefix: { type: 'string', nullable: true },
    textSuffix: { type: 'string', nullable: true },
    textDefault: { type: 'string', nullable: true },
    textCompute: { type: 'string', nullable: true },
    textComputeSource: { type: 'string', nullable: true },
    textFormat: { type: 'string', nullable: true },
    textParse: { type: 'string', nullable: true },
    textProcess: { type: 'string', nullable: true },
    textBasic: { type: 'string', nullable: true },
    textEmail: { type: 'string', nullable: true },
    textUrl: { type: 'string', nullable: true },
    textHostname: { type: 'string', nullable: true },
    textDomain: { type: 'string', nullable: true },
    textTel: { type: 'string', nullable: true },
    textPassword: { type: 'string', nullable: true },
    textCreditcard: { type: 'string', nullable: true },
    textTrim: { type: 'string', nullable: true }
  }
}
