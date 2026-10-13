import { mixin } from '@ditojs/utils'

export const TimestampedMixin = mixin(
  Model =>
    class extends Model {
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
        timestamped: query =>
          query
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
    }
)
