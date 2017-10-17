import Model from '../core/Model'

export default class Message extends Model {
  static timestamps = true
  static properties = {
    text: {
      type: 'string',
      required: true
    }
  }

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
