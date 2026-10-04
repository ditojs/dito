import { defineCases } from './define.js'

const fruits = [
  { label: 'Apple', value: 'apple' },
  { label: 'Grape', value: 'grape' },
  { label: 'Pear', value: 'pear' }
]

const sizes = [
  { label: 'Small', value: 's' },
  { label: 'Medium', value: 'm' },
  { label: 'Large', value: 'l' }
]

export default [
  defineCases('multiselect', { type: 'string' }, [
    {
      title: 'stores the value of a selected option',
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
      title: 'stores the values of multiple selected options',
      schema: { options: sizes, multiple: true },
      property: { type: 'array' },
      value: ['Small', 'Large'],
      stored: ['s', 'l']
    },
    {
      title: 'shows the labels of multiple stored values',
      schema: { options: sizes, multiple: true },
      property: { type: 'array' },
      seed: ['m', 'l'],
      shown: ['Medium', 'Large']
    },
    {
      title: 'finds options by search with searchable',
      schema: { options: sizes, searchable: true },
      value: 'Large',
      stored: 'l'
    },
    {
      title: 'finds options with a debounced search filter',
      schema: {
        search: {
          debounce: 200,
          filter: async ({ searchTerm }: { searchTerm: string }) => {
            const global = globalThis as { searchCalls?: number }
            global.searchCalls = (global.searchCalls ?? 0) + 1
            return fruits.filter(fruit =>
              fruit.label.toLowerCase().includes(searchTerm.toLowerCase())
            )
          }
        },
        searchable: true,
        // Provides the labels of stored values, as searching is the only way
        // to get options otherwise.
        options: { data: fruits, label: 'label', value: 'value' }
      },
      value: 'Pear',
      stored: 'pear'
    },
    {
      title: 'uses async options from options.data',
      schema: {
        options: {
          data: async () => [
            { name: 'Alpha', id: 'a' },
            { name: 'Beta', id: 'b' }
          ],
          label: 'name',
          value: 'id'
        }
      },
      value: 'Beta',
      stored: 'b'
    },
    {
      title: 'groups options with groupBy',
      schema: {
        options: {
          data: [
            { label: 'Apple', value: 'apple', kind: 'Fruit' },
            { label: 'Carrot', value: 'carrot', kind: 'Vegetable' }
          ],
          groupBy: 'kind'
        }
      },
      value: 'Carrot',
      stored: 'carrot'
    },
    {
      title: 'adds new tags with taggable',
      schema: {
        options: ['One', 'Two'],
        multiple: true,
        searchable: true,
        taggable: true
      },
      property: { type: 'array' },
      value: ['One', { tag: 'Three' }],
      stored: ['One', 'Three'],
      shown: ['One', 'Three']
    }
  ])
]
