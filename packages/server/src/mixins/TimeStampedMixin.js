import { mixin } from '@ditojs/utils'

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
      const now = new Date()
      for (const item of inputItems) {
        item.createdAt = now
        item.updatedAt = now
      }
    },

    'before:update'({ inputItems }) {
      const now = new Date()
      for (const item of inputItems) {
        item.updatedAt = now
      }
    }
  }
})
