import { defineCases } from './define.js'
import input from './components/custom-input.js'

export default [
  defineCases('component', { type: 'string' }, [
    {
      title: 'stores values that custom components change',
      schema: { component: input },
      value: 'Changed',
      stored: 'Changed'
    },
    {
      title: 'shows stored values in custom components',
      schema: { component: input },
      seed: 'Stored',
      shown: 'Stored'
    },
    {
      title: 'resolves custom components from imports',
      schema: { component: import('./components/custom-input.js') },
      value: 'Imported',
      stored: 'Imported'
    },
    {
      title: 'resolves custom components from functions',
      schema: { component: () => import('./components/custom-input.js') },
      value: 'Imported',
      stored: 'Imported'
    },
    {
      // Like lineto's badges and messages.
      title: 'shows computed values instead of stored ones',
      schema: {
        component: input,
        exclude: true,
        compute: () => 'Computed'
      },
      seed: 'Stored',
      shown: 'Computed'
    }
  ])
]
