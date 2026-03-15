import { createWidgetView } from './createWidgetView.js'

export const number = createWidgetView('numberBasic', 'number-widgets', {
  // Number variants
  numberBasic: {
    type: 'number',
    label: 'Basic Number'
  },
  numberMinMax: {
    type: 'number',
    label: 'Min/Max',
    min: 0,
    max: 100
  },
  numberRange: {
    type: 'number',
    label: 'Range',
    range: [10, 50]
  },
  numberStep: {
    type: 'number',
    label: 'Step',
    step: 5
  },
  numberStepClearable: {
    type: 'number',
    label: 'Step Clearable',
    step: 5,
    clearable: true
  },
  numberStepFractional: {
    type: 'number',
    label: 'Step Fractional',
    step: 0.25
  },
  numberDecimals: {
    type: 'number',
    label: 'Decimals',
    decimals: 2
  },
  numberPrefixSuffix: {
    type: 'number',
    label: 'Prefix/Suffix',
    prefix: '$',
    suffix: 'USD'
  },
  // Integer variants
  integerBasic: {
    type: 'integer',
    label: 'Basic Integer'
  },
  integerStep: {
    type: 'integer',
    label: 'Integer Step',
    step: 3
  },
  integerMinMaxRounding: {
    type: 'integer',
    label: 'Integer Min/Max Rounding',
    min: 1.5,
    max: 9.7
  }
})
