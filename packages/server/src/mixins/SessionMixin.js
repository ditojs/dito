import { mixin } from '@ditojs/utils'

export const SessionMixin = mixin(
  Model =>
    class extends Model {
      static properties = {
        id: {
          type: 'string',
          primary: true
        },

        value: {
          type: 'object'
        },

        expiresAt: {
          type: 'timestamp',
          nullable: true,
          index: true
        }
      }

      // @override
      static async deleteExpiredRecords() {
        await super.deleteExpiredRecords()
        await this.query().where('expiresAt', '<', new Date()).delete()
      }
    }
)
