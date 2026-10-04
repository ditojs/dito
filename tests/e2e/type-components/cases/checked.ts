import { defineCases } from './define.js'

const boolean = { type: 'boolean' }

export default [
  defineCases('switch', boolean, [
    { title: 'stores true when switched on', value: true, stored: true },
    {
      title: 'stores false when switched off',
      seed: true,
      value: false,
      stored: false
    },
    { title: 'shows a stored value', seed: true, shown: true }
  ]),
  defineCases('checkbox', boolean, [
    { title: 'stores true when checked', value: true, stored: true },
    {
      title: 'stores false when unchecked',
      seed: true,
      value: false,
      stored: false
    },
    { title: 'shows a stored value', seed: true, shown: true }
  ])
]
