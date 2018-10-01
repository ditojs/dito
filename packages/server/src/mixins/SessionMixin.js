export const SessionMixin = Model => class extends Model {
  static properties = {
    id: {
      type: 'string',
      primary: true
    },

    value: {
      type: 'object'
    }
  }
}
