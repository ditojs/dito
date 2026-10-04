import { defineCases } from './define.js'

export default [
  defineCases('code', { type: 'text' }, [
    {
      title: 'stores the entered code',
      value: 'const x = 1\nconsole.log(x)',
      stored: 'const x = 1\nconsole.log(x)'
    },
    {
      title: 'shows stored code',
      seed: 'let y = 2',
      shown: 'let y = 2'
    }
  ])
]
