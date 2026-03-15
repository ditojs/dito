import { createWidgetView } from './createWidgetView.js'

export const select = createWidgetView('selectString', 'select-widgets', {
  selectString: {
    type: 'select',
    label: 'String Options',
    options: ['alpha', 'beta', 'gamma']
  },
  selectLabelValue: {
    type: 'select',
    label: 'Label/Value',
    options: [
      { label: 'Alpha', value: 'a' },
      { label: 'Beta', value: 'b' }
    ]
  },
  selectGroupBy: {
    type: 'select',
    label: 'Group By',
    options: [
      { label: 'A1', value: 'a1', cat: 'Group A' },
      { label: 'B1', value: 'b1', cat: 'Group B' }
    ],
    groupBy: 'cat'
  },
  selectClearable: {
    type: 'select',
    label: 'Clearable',
    options: ['alpha', 'beta'],
    clearable: true
  },
  selectPrefixSuffix: {
    type: 'select',
    label: 'Prefix/Suffix',
    options: ['alpha', 'beta'],
    prefix: 'Pick:',
    suffix: '!'
  },
  multiselectBasic: {
    type: 'multiselect',
    label: 'Multiselect Basic',
    options: ['alpha', 'beta', 'gamma']
  },
  multiselectMultiple: {
    type: 'multiselect',
    label: 'Multiselect Multiple',
    options: ['alpha', 'beta', 'gamma'],
    multiple: true
  },
  multiselectSearchable: {
    type: 'multiselect',
    label: 'Multiselect Searchable',
    options: ['alpha', 'beta', 'gamma'],
    multiple: true,
    searchable: true
  },
  multiselectTaggable: {
    type: 'multiselect',
    label: 'Multiselect Taggable',
    options: ['alpha', 'beta', 'gamma'],
    multiple: true,
    taggable: true,
    searchable: true
  },
  radioVertical: {
    type: 'radio',
    label: 'Radio Vertical',
    options: ['alpha', 'beta', 'gamma']
  },
  radioHorizontal: {
    type: 'radio',
    label: 'Radio Horizontal',
    options: ['alpha', 'beta', 'gamma'],
    layout: 'horizontal'
  },
  checkboxesVertical: {
    type: 'checkboxes',
    label: 'Checkboxes Vertical',
    options: ['alpha', 'beta', 'gamma']
  },
  checkboxesHorizontal: {
    type: 'checkboxes',
    label: 'Checkboxes Horizontal',
    options: ['alpha', 'beta', 'gamma'],
    layout: 'horizontal'
  }
})
