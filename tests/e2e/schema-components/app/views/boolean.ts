import { createWidgetView } from './createWidgetView.js'

export const boolean = createWidgetView('checkboxBasic', 'boolean-widgets', {
  checkboxBasic: {
    type: 'checkbox',
    label: 'Basic Checkbox'
  },
  switchBasic: {
    type: 'switch',
    label: 'Basic Switch'
  },
  switchLabels: {
    type: 'switch',
    label: 'Switch Labels',
    labels: { checked: 'Yes', unchecked: 'No' }
  }
})
