export default {
  collection: {
    get: true,
    post: true,
    patch: true
  },
  // Could also be `collection: false` to turn everything off

  instance: {
    get: ['admin', 'editor'], // true,
    put: ['admin', 'editor'],
    patch: true,
    post: 'admin',
    delete: {
      access: 'admin'
    }
  },

  relations: {
    messages: {
      relation: true,
      instance: false
    }
    /*
    someHasManyRelation: {
      relation: ...
      instance: ...
    }
    someHasOneRelation: ...
    */
  }
}
