export default {
  collection: {
    get: true
  },
  // Could also be `collection: false` to turn everything off

  member: {
    get: true,
    put: ['admin', 'editor'],
    post: 'admin',
    delete: 'admin'
  },

  relations: {
    /*
    hasMany: {
      relation: ...
      member: ...
    }
    hasOne: ...
    */
  }
}
