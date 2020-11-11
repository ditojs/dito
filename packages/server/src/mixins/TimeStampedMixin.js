import { mixin } from '@ditojs/utils'
import { fn } from 'objection'

export const TimeStampedMixin = mixin(Model => class extends Model {
  static properties = {
    createdAt: {
      type: 'timestamp',
      default: 'now()'
    },

    updatedAt: {
      type: 'timestamp',
      default: 'now()'
    }
  }

  static scopes = {
    timeStamped: query => query
      .select('createdAt', 'updatedAt')
  }

  static hooks = {
    'before:insert'({ inputItems }) {
      for (const item of inputItems) {
        item.createdAt = item.updatedAt = fn.now()
      }
    },

    'before:update'({ inputItems }) {
      for (const item of inputItems) {
        item.updatedAt = fn.now()
      }
    }
  }
})
