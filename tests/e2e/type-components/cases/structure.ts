import { defineCases } from './define.js'

const form = {
  type: 'form',
  components: { name: { type: 'text', label: 'Name' } }
}

const inlinedList = {
  inlined: true,
  creatable: true,
  deletable: true,
  form
}

// Lists that edit their items in nested forms, opened through their routes.
const formList = {
  creatable: true,
  editable: true,
  deletable: true,
  form
}

export default [
  defineCases('list', { type: 'array', default: [] }, [
    {
      title: 'stores added items',
      schema: inlinedList,
      value: [{ add: { Name: 'One' } }, { add: { Name: 'Two' } }],
      stored: [{ name: 'One' }, { name: 'Two' }],
      shown: [{ Name: 'One' }, { Name: 'Two' }]
    },
    {
      title: 'stores added items without a default value',
      schema: inlinedList,
      property: { default: undefined },
      value: [{ add: { Name: 'One' } }],
      stored: [{ name: 'One' }]
    },
    {
      title: 'shows stored items',
      schema: inlinedList,
      seed: [{ name: 'One' }, { name: 'Two' }],
      shown: [{ Name: 'One' }, { Name: 'Two' }]
    },
    {
      title: 'stores removed items',
      schema: inlinedList,
      seed: [{ name: 'One' }, { name: 'Two' }],
      value: [{ remove: 0 }],
      stored: [{ name: 'Two' }],
      shown: [{ Name: 'Two' }]
    },
    {
      title: 'stores reordered items with draggable',
      schema: { ...inlinedList, draggable: true },
      seed: [{ name: 'One' }, { name: 'Two' }],
      value: [{ move: [0, 1] }],
      stored: [{ name: 'Two' }, { name: 'One' }],
      shown: [{ Name: 'Two' }, { Name: 'One' }]
    },
    {
      title: 'stores primitive values with wrapPrimitives',
      schema: { ...inlinedList, wrapPrimitives: 'name' },
      value: [{ add: { Name: 'One' } }, { add: { Name: 'Two' } }],
      stored: ['One', 'Two'],
      shown: [{ Name: 'One' }, { Name: 'Two' }]
    },
    {
      title: 'stores edited primitive values with wrapPrimitives',
      schema: { ...inlinedList, wrapPrimitives: 'name' },
      seed: ['One', 'Two'],
      value: [{ edit: 1, fields: { Name: 'Changed' } }],
      stored: ['One', 'Changed']
    },
    {
      title: 'stores removed primitive values with wrapPrimitives',
      schema: { ...inlinedList, wrapPrimitives: 'name' },
      seed: ['One', 'Two', 'Three'],
      value: [{ remove: 1 }],
      stored: ['One', 'Three']
    },
    {
      title: 'stores reordered and edited primitive values with wrapPrimitives',
      schema: { ...inlinedList, wrapPrimitives: 'name', draggable: true },
      seed: ['One', 'Two', 'Three'],
      value: [{ move: [0, 1] }, { edit: 0, fields: { Name: 'Changed' } }],
      stored: ['Changed', 'One', 'Three']
    },
    {
      title: 'stores order keys with orderKey',
      schema: { ...inlinedList, draggable: true, orderKey: 'order' },
      seed: [
        { name: 'One', order: 0 },
        { name: 'Two', order: 1 }
      ],
      value: [{ move: [0, 1] }, { add: { Name: 'Three' } }],
      stored: [
        { name: 'Two', order: 0 },
        { name: 'One', order: 1 },
        { name: 'Three', order: 2 }
      ]
    },
    {
      title: 'stores items edited in their forms',
      schema: formList,
      seed: [{ name: 'One' }, { name: 'Two' }],
      value: [{ open: 1, fill: { Name: 'Changed' }, then: 'Apply' }],
      stored: [{ name: 'One' }, { name: 'Changed' }],
      shown: ['One', 'Changed']
    },
    {
      title: 'discards edits of closed item forms',
      schema: formList,
      seed: [{ name: 'One' }, { name: 'Two' }],
      value: [{ open: 0, fill: { Name: 'Changed' }, then: 'Close' }],
      stored: [{ name: 'One' }, { name: 'Two' }]
    },
    {
      title: 'stores items created in their forms',
      schema: formList,
      seed: [{ name: 'One' }],
      value: [{ create: true, fill: { Name: 'Two' }, then: 'Add' }],
      stored: [{ name: 'One' }, { name: 'Two' }]
    },
    {
      title: 'stores items edited directly in their forms with mutate',
      schema: { ...formList, mutate: true },
      seed: [{ name: 'One' }],
      value: [{ open: 0, fill: { Name: 'Changed' }, then: 'Close' }],
      stored: [{ name: 'Changed' }]
    },
    {
      title: 'stores items of multiple forms',
      schema: {
        inlined: true,
        creatable: true,
        deletable: true,
        forms: {
          text: {
            type: 'form',
            label: 'Text',
            components: { text: { type: 'text', label: 'Text' } }
          },
          link: {
            type: 'form',
            label: 'Link',
            components: { url: { type: 'url', label: 'Url' } }
          }
        }
      },
      value: [
        { add: { Text: 'Hello' }, form: 'Text' },
        { add: { Url: 'https://lineto.com' }, form: 'Link' }
      ],
      stored: [
        { type: 'text', text: 'Hello' },
        { type: 'link', url: 'https://lineto.com' }
      ]
    }
  ]),
  defineCases('object', { type: 'object' }, [
    {
      title: 'stores the fields of an inlined object',
      schema: { inlined: true, form },
      seed: {},
      value: { Name: 'Hello' },
      stored: { name: 'Hello' },
      shown: { Name: 'Hello' }
    },
    {
      title: 'shows a stored object',
      schema: { inlined: true, form },
      seed: { name: 'Stored' },
      shown: { Name: 'Stored' }
    },
    {
      title: 'stores an object created in its form',
      schema: { creatable: true, form },
      value: { create: true, fill: { Name: 'Hello' }, then: 'Add' },
      stored: { name: 'Hello' }
    },
    {
      title: 'stores an object edited in its form',
      schema: { editable: true, form },
      seed: { name: 'Hello' },
      value: { open: true, fill: { Name: 'Changed' }, then: 'Apply' },
      stored: { name: 'Changed' },
      shown: 'Changed'
    },
    {
      title: 'removes an inlined object with deletable',
      schema: { inlined: true, deletable: true, form },
      seed: { name: 'Hello' },
      value: { remove: true },
      stored: null
    },
    {
      title: 'removes an object with deletable',
      schema: { deletable: true, form },
      seed: { name: 'Hello' },
      value: { remove: true },
      stored: null
    }
  ])
]
