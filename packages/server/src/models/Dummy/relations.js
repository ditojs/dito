export default {
  messages: {
    relation: 'hasMany',
    modelClass: 'Message',
    join: {
      from: 'Dummy.id',
      to: 'Message.dummyId'
    }
  }
}
