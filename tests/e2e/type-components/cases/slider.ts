import { defineCases } from './define.js'

export default [
  defineCases('slider', { type: 'number' }, [
    {
      title: 'stores the entered value',
      schema: { range: [0, 10], step: 1 },
      value: '7',
      stored: 7
    },
    {
      title: 'shows a stored value',
      schema: { range: [0, 10], step: 1 },
      seed: 3,
      shown: '3'
    },
    {
      title: 'stores decimal steps',
      schema: { range: [0, 1], step: 0.1 },
      value: '0.5',
      stored: 0.5
    }
  ])
]
