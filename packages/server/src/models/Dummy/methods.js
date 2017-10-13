export default {
  hello: {
    arguments: [{
      name: 'msg',
      type: 'string',
      required: true
    }],
    return: {
      name: 'greeting',
      type: 'string'
    },
    verb: 'get'
  },

  somethingStatic: {
    static: true,
    return: {
      type: 'string'
    },
    verb: 'get',
    path: 'something'
  }
}
