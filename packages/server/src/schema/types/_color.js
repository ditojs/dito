// The values that the admin's color type stores, see `DitoTypeColor`: strings
// for its hex formats and color keywords, and objects for its `rgb`, `prgb`,
// `hsl` and `hsv` formats, with the alpha channel in `a`.
export const color = {
  anyOf: [
    { type: 'string', format: 'color' },
    getColorObjectSchema(['r', 'g', 'b']),
    // Percentages, e.g. `'100%'`:
    getColorObjectSchema(['r', 'g', 'b'], 'string'),
    getColorObjectSchema(['h', 's', 'l']),
    getColorObjectSchema(['h', 's', 'v'])
  ]
}

function getColorObjectSchema(keys, type = 'number') {
  return {
    type: 'object',
    properties: Object.fromEntries([
      ...keys.map(key => [key, { type, required: true }]),
      ['a', { type: 'number' }]
    ])
  }
}
