import { defineCases } from './define.js'

export default [
  defineCases('number', { type: 'number' }, [
    { title: 'stores the entered number', value: '42', stored: 42 },
    { title: 'stores a decimal number', value: '3.5', stored: 3.5 },
    { title: 'shows a stored number', seed: 7.25, shown: '7.25' },
    {
      title: 'stores null for an empty value',
      seed: 7,
      value: '',
      stored: null
    },
    {
      title: 'accepts as many decimals as allowed',
      schema: { decimals: 2 },
      value: '3.14',
      stored: 3.14
    },
    {
      title: 'rejects more decimals than allowed',
      schema: { decimals: 2 },
      value: '3.14159',
      invalid: true
    },
    {
      title: 'rejects a value outside range',
      schema: { range: [0, 10] },
      value: '42',
      invalid: true
    },
    {
      title: 'rejects a value below min',
      schema: { min: 5 },
      value: '3',
      invalid: true
    },
    {
      title: 'stores the parsed value with format and parse',
      schema: {
        suffix: '%',
        format: ({ value }: { value: number | null }) =>
          value == null ? value : value * 100,
        parse: ({ value }: { value: number | null }) =>
          value == null ? value : value / 100
      },
      value: '50',
      stored: 0.5,
      shown: '50'
    }
  ]),
  defineCases('integer', { type: 'integer' }, [
    { title: 'stores the entered integer', value: '42', stored: 42 },
    { title: 'rejects a decimal number', value: '4.2', invalid: true }
  ])
]
