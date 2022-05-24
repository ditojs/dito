export const range = {
  type: ['number', 'integer'],
  metaSchema: {
    type: 'array',
    prefixItems: [
      { type: 'number' },
      { type: 'number' }
    ],
    minItems: 2,
    items: false
  },
  macro(config) {
    return {
      minimum: config[0],
      maximum: config[1]
    }
  }
}
