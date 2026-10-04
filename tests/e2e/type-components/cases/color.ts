import { defineCases } from './define.js'

export default [
  defineCases('color', { type: 'string' }, [
    {
      title: 'stores typed hex as lowercase hex',
      value: 'FF7F27',
      stored: '#ff7f27',
      shown: 'ff7f27'
    },
    {
      title: 'shows a stored value without hash',
      seed: '#00a2e8',
      shown: '00a2e8'
    },
    {
      title: 'is clearable with clearable',
      schema: { clearable: true },
      seed: '#00a2e8',
      shown: '00a2e8'
    },
    {
      title: 'stores a picked preset',
      value: { pick: '#ed1c24' },
      stored: '#ed1c24',
      shown: 'ed1c24'
    },
    {
      title: 'stores the transparent preset as hex8 with alpha',
      schema: { alpha: true },
      value: { pick: 'transparency' },
      stored: '#00000000',
      shown: '00000000'
    },
    {
      title: 'stores an rgb object with format rgb',
      schema: { format: 'rgb' },
      property: { type: 'object' },
      value: { pick: '#ed1c24' },
      stored: { r: 237, g: 28, b: 36, a: 1 },
      shown: 'ed1c24'
    },
    {
      title: 'shows a stored rgb object as hex',
      schema: { format: 'rgb' },
      property: { type: 'object' },
      seed: { r: 0, g: 162, b: 232, a: 1 },
      shown: '00a2e8'
    },
    {
      title: 'stores an hsl object with format hsl',
      schema: { format: 'hsl' },
      property: { type: 'object' },
      value: { pick: '#ffffff' },
      stored: { h: 0, s: 0, l: 1, a: 1 },
      shown: 'ffffff'
    },
    {
      title: 'shows a stored hsl object as hex',
      schema: { format: 'hsl' },
      property: { type: 'object' },
      seed: { h: 0, s: 0, l: 1, a: 1 },
      shown: 'ffffff'
    },
    {
      title: 'stores a color name with format name',
      schema: { format: 'name' },
      value: { pick: '#000000' },
      stored: 'black',
      shown: '000000'
    }
  ])
]
