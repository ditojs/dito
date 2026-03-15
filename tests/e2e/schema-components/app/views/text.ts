import type { TextWidget } from '../../models/TextWidget.js'
import { createWidgetView } from './createWidgetView.js'

export const text = createWidgetView<TextWidget>('textBasic', 'text-widgets', {
  // Shared base config components
  textReadonly: {
    type: 'text',
    label: 'Readonly',
    readonly: true
  },
  textDisabled: {
    type: 'text',
    label: 'Disabled',
    disabled: true
  },
  textClearable: {
    type: 'text',
    label: 'Clearable',
    clearable: true
  },
  textPlaceholder: {
    type: 'text',
    label: 'Placeholder',
    placeholder: 'hint text'
  },
  textRequired: {
    type: 'text',
    label: 'Required',
    required: true
  },
  textInfo: {
    type: 'text',
    label: 'Info',
    info: 'help text'
  },
  textWidthAuto: {
    type: 'text',
    label: 'Width Auto',
    width: 'auto'
  },
  textWidthFill: {
    type: 'text',
    label: 'Width Fill',
    width: 'fill'
  },
  textWidthHalf: {
    type: 'text',
    label: 'Width Half',
    width: '50%'
  },
  textWidthThird: {
    type: 'text',
    label: 'Width Third',
    width: '1/3'
  },
  textLabelFalse: {
    type: 'text',
    label: false
  },
  textPrefix: {
    type: 'text',
    label: 'Prefix',
    prefix: '$'
  },
  textSuffix: {
    type: 'text',
    label: 'Suffix',
    suffix: 'kg'
  },
  textDefault: {
    type: 'text',
    label: 'Default',
    default: 'fallback'
  },
  textComputeSource: {
    type: 'text',
    label: 'Compute Source'
  },
  textCompute: {
    type: 'text',
    label: 'Compute',
    compute: ({ item }) => item.textComputeSource
  },
  textFormat: {
    type: 'text',
    label: 'Format',
    format: ({ value }) => value ? value.toUpperCase() : value
  },
  textParse: {
    type: 'text',
    label: 'Parse',
    parse: ({ value }) => value ? value.toLowerCase() : value
  },
  textProcess: {
    type: 'text',
    label: 'Process',
    process: ({ value }) => value ? value.trim() : value
  },
  // Text subtype components
  textBasic: {
    type: 'text',
    label: 'Basic Text'
  },
  textEmail: {
    type: 'email',
    label: 'Email'
  },
  textUrl: {
    type: 'url',
    label: 'URL'
  },
  textHostname: {
    type: 'hostname',
    label: 'Hostname'
  },
  textDomain: {
    type: 'domain',
    label: 'Domain'
  },
  textTel: {
    type: 'tel',
    label: 'Telephone'
  },
  textPassword: {
    type: 'password',
    label: 'Password'
  },
  textCreditcard: {
    type: 'creditcard',
    label: 'Credit Card'
  },
  textTrim: {
    type: 'text',
    label: 'Trim',
    trim: true
  }
})
