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
    }
  ])
]
