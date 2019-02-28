import { mixin } from '@/utils'

export const SessionMixin = mixin(Model => class extends Model {
  static properties = {
    id: {
      type: 'string',
      primary: true
    },

    value: {
      type: 'object'
    }
  }
})
