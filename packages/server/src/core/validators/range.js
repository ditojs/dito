export const range = {
  keyword: 'range',
  type: ['number', 'integer'],
  metaSchema: {
    type: 'array',
    items: [
      { type: 'number' },
      { type: 'number' }
    ],
    additionalItems: false
  },
  macro(config) {
    return {
      minimum: config[0],
      maximum: config[1]
    }
  }
}
