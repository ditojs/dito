import { defineCases } from './define.js'

const text = (label: string) => ({ type: 'text', label })

export default [
  defineCases('section', { type: 'object', default: {} }, [
    {
      title: 'stores nested fields as an object',
      schema: {
        nested: true,
        components: { first: text('First'), last: text('Last') }
      },
      value: { First: 'Ada', Last: 'Lovelace' },
      stored: { first: 'Ada', last: 'Lovelace' },
      shown: { First: 'Ada', Last: 'Lovelace' }
    },
    {
      title: 'stores values of computed components',
      schema: {
        nested: true,
        components: {
          first: text('First'),
          upper: {
            type: 'computed',
            label: 'Upper',
            compute: ({ item }: { item: { first?: string } }) =>
              item.first?.toUpperCase()
          }
        }
      },
      value: { First: 'ada' },
      stored: { first: 'ada', upper: 'ADA' }
    },
    {
      title: 'stores values of data components',
      schema: {
        nested: true,
        components: {
          first: text('First'),
          upper: {
            type: 'data',
            data: ({ item }: { item: { first?: string } }) =>
              item.first?.toUpperCase()
          }
        }
      },
      value: { First: 'ada' },
      stored: { first: 'ada', upper: 'ADA' }
    },
    {
      title: 'keeps values of hidden components',
      schema: {
        nested: true,
        components: { first: text('First'), secret: { type: 'hidden' } }
      },
      seed: { first: 'Ada', secret: 'kept' },
      value: { First: 'Grace' },
      stored: { first: 'Grace', secret: 'kept' }
    },
    {
      title: 'changes values with button click events',
      schema: {
        nested: true,
        components: {
          first: text('First'),
          fill: {
            type: 'button',
            text: 'Fill',
            events: {
              click: ({ item }: { item: { first?: string } }) => {
                item.first = 'Filled'
              }
            }
          }
        }
      },
      value: [{ click: 'Fill' }],
      stored: { first: 'Filled' },
      shown: { First: 'Filled' }
    }
  ]),
  defineCases('label', { type: 'string' }, [
    { title: 'shows its label as text', shown: 'Label 1' }
  ]),
  defineCases('progress', { type: 'number' }, [
    {
      title: 'shows its value as progress',
      schema: { range: [0, 1] },
      seed: 0.25,
      shown: '0.25'
    }
  ])
]
