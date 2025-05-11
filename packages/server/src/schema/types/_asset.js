export const asset = {
  type: 'object',
  properties: {
    key: {
      type: 'string',
      required: true
    },
    name: {
      type: 'string',
      required: true
    },
    type: {
      type: 'string',
      required: true
    },
    size: {
      type: 'integer',
      required: true
    },
    url: {
      type: 'string',
      format: 'uri'
    },
    width: {
      type: 'integer'
    },
    height: {
      type: 'integer'
    }
  }
}
