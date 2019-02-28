import { mixin } from '@/utils'

export const AssetMixin = mixin(Model => class extends Model {
  static properties = {
    name: {
      type: 'string',
      required: true,
      unique: true,
      index: true
    },

    file: {
      type: 'object'
      // TODO: Support this on 'object'
      // required: true
    },

    storage: {
      type: 'string',
      required: true
    },

    count: {
      type: 'integer',
      unsigned: true,
      default: 0
    }
  }
})
