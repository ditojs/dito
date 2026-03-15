import { createWidgetView } from './createWidgetView.js'

export const date = createWidgetView('dateBasic', 'date-widgets', {
  dateBasic: {
    type: 'date',
    label: 'Basic Date'
  },
  dateClearable: {
    type: 'date',
    label: 'Date Clearable',
    clearable: true
  },
  datePrefix: {
    type: 'date',
    label: 'Date Prefix',
    prefix: 'From:'
  },
  datetimeBasic: {
    type: 'datetime',
    label: 'Basic Datetime'
  },
  timeBasic: {
    type: 'time',
    label: 'Basic Time'
  },
  colorBasic: {
    type: 'color',
    label: 'Basic Color'
  },
  colorAlpha: {
    type: 'color',
    label: 'Color Alpha',
    alpha: true
  },
  colorNoValue: {
    type: 'color',
    label: 'Color No Value'
  }
})
