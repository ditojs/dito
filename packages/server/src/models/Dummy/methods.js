export default {
  hello: {
    arguments: [{
      name: 'msg',
      type: 'string'
    }],
    return: {
      name: 'greeting',
      type: 'string'
    },
    verb: 'get'
  },
  somethingStatic: {
    static: true,
    verb: 'post',
    path: 'something'
  }
}
