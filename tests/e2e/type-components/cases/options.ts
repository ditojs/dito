import { defineCases } from './define.js'

const sizes = [
  { label: 'Small', value: 's' },
  { label: 'Medium', value: 'm' },
  { label: 'Large', value: 'l' }
]

export default [
  defineCases('select', { type: 'string' }, [
    {
      title: 'stores a selected string option',
      schema: { options: ['Small', 'Medium', 'Large'] },
      value: 'Medium',
      stored: 'Medium'
    },
    {
      title: 'stores the value of a selected option object',
      schema: { options: sizes },
      value: 'Medium',
      stored: 'm'
    },
    {
      title: 'shows the label of a stored value',
      schema: { options: sizes },
      seed: 'l',
      shown: 'Large'
    },
    {
      title: 'stores numeric option values',
      schema: {
        options: [
          { label: 'One', value: 1 },
          { label: 'Two', value: 2 }
        ]
      },
      property: { type: 'integer' },
      value: 'Two',
      stored: 2
    },
    {
      title: 'uses options from options.data',
      schema: {
        options: {
          data: () => [
            { name: 'Alpha', id: 'a' },
            { name: 'Beta', id: 'b' }
          ],
          label: 'name',
          value: 'id'
        }
      },
      value: 'Beta',
      stored: 'b'
    }
  ]),
  defineCases('radio', { type: 'string' }, [
    {
      title: 'stores the value of the checked option',
      schema: { options: sizes },
      value: 'Medium',
      stored: 'm'
    },
    {
      title: 'shows the stored option as checked',
      schema: { options: sizes },
      seed: 'l',
      shown: 'Large'
    },
    {
      title: 'stores options with a horizontal layout',
      schema: { options: sizes, layout: 'horizontal' },
      value: 'Small',
      stored: 's'
    }
  ]),
  defineCases('checkboxes', { type: 'array' }, [
    {
      title: 'stores the values of the checked options',
      schema: { options: sizes },
      value: ['Small', 'Large'],
      stored: ['s', 'l']
    },
    {
      title: 'shows the stored options as checked',
      schema: { options: sizes },
      seed: ['m'],
      shown: ['Medium']
    },
    {
      title: 'stores unchecked options',
      schema: { options: sizes },
      seed: ['s', 'm'],
      value: ['Medium'],
      stored: ['m']
    }
  ])
]
