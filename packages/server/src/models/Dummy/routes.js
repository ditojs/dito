export default {
  collection: {
    get: true
  },
  // Could also be `collection: false` to turn everything off

  instance: {
    get: ['admin', 'editor'], // true,
    put: ['admin', 'editor'],
    post: 'admin',
    delete: {
      access: 'admin'
    }
  },

  relations: {
    /*
    someHasManyRelation: {
      relation: ...
      instance: ...
    }
    someHasOneRelation: ...
    */
  }
}
