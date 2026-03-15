import { createWidgetView } from './createWidgetView.js'

export const slider = createWidgetView('sliderBasic', 'slider-widgets', {
  // Slider variants
  sliderBasic: {
    type: 'slider',
    label: 'Basic Slider',
    min: 0,
    max: 100,
    step: 1
  },
  sliderNoInput: {
    type: 'slider',
    label: 'No Input',
    min: 0,
    max: 100,
    step: 1,
    input: false
  },
  sliderStep: {
    type: 'slider',
    label: 'Step',
    min: 0,
    max: 100,
    step: 10
  },
  sliderRange: {
    type: 'slider',
    label: 'Range',
    range: [10, 50],
    step: 1
  },
  sliderDecimals: {
    type: 'slider',
    label: 'Decimals',
    min: 0,
    max: 1,
    step: 0.1,
    decimals: 1
  },
  // Progress variants
  progressBasic: {
    type: 'progress',
    label: 'Basic Progress',
    min: 0,
    max: 100
  },
  progressRange: {
    type: 'progress',
    label: 'Range Progress',
    range: [20, 80]
  },
  progressStep: {
    type: 'progress',
    label: 'Step Progress',
    min: 0,
    max: 100,
    step: 10
  },
  progressNull: {
    type: 'progress',
    label: 'Null Progress',
    min: 0,
    max: 100
  }
})
