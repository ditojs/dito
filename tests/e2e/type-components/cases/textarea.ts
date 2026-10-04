import { defineCases } from './define.js'

export default [
  defineCases('textarea', { type: 'text' }, [
    {
      title: 'stores text with line breaks',
      value: 'Line 1\nLine 2',
      stored: 'Line 1\nLine 2'
    },
    {
      title: 'shows a stored value',
      seed: 'Seeded\ntext',
      shown: 'Seeded\ntext'
    }
  ])
]
