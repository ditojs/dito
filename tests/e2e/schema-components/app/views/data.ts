import { createWidgetView } from './createWidgetView.js'
import type { DataWidget } from '../../models/DataWidget.js'

export const data = createWidgetView<DataWidget>(
  'dataTextBasic',
  'data-widgets',
  {
    dataTextBasic: {
      type: 'text',
      label: 'Text Source'
    },
    hiddenCompute: {
      type: 'hidden',
      compute: ({ item }) =>
        item.dataTextBasic?.toUpperCase()
    },
    hiddenDefault: {
      type: 'hidden',
      default: 'default-hidden'
    },
    computedCompute: {
      type: 'computed',
      compute: ({ item }) =>
        item.dataTextBasic?.toLowerCase()
    }
  }
)
