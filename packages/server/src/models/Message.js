import Model from '../core/Model'

export default class Message extends Model {
  static relations = {
    dummy: {
      relation: 'hasOne',
      modelClass: 'Dummy',
      join: {
        from: 'Message.dummyId',
        to: 'Dummy.id'
      }
    }
  }

  static routes = {
    relations: {
      dummy: true
    }
  }
}
