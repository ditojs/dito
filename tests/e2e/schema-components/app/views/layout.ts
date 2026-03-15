import { createWidgetView } from './createWidgetView.js'

import type { Components } from '@ditojs/admin'
import type { LayoutWidget } from '../../models/LayoutWidget.js'

const components: Components<LayoutWidget> = {
  sectionLabelled: {
    type: 'section',
    label: 'Details',
    components: {
      sectionDetail: { type: 'text', label: 'Detail' }
    }
  },
  sectionCollapsible: {
    type: 'section',
    label: 'Collapsible',
    collapsible: true,
    components: {
      sectionDetail: { type: 'text', label: 'Detail' }
    }
  },
  sectionNested: {
    type: 'section',
    label: 'Nested',
    nested: true,
    components: {
      street: { type: 'text', label: 'Street' },
      city: { type: 'text', label: 'City' }
    }
  },
  buttonBasic: {
    type: 'button',
    text: 'Click Me',
    onClick({ component }) {
      component!.$el.dataset.clicked = 'true'
    }
  },
  submitBasic: {
    type: 'submit',
    text: 'Save'
  },
  buttonDisabled: {
    type: 'button',
    text: 'Disabled',
    disabled: true
  },
  labelDefault: {
    type: 'label',
    default: 'Read-only info'
  },
  spacerBasic: {
    type: 'spacer'
  }
}

export const layout = createWidgetView<LayoutWidget>(
  'sectionDetail',
  'layout-widgets',
  components
)
