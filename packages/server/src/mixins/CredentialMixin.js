import { mixin } from '@ditojs/utils'

export const CredentialMixin = mixin(
  Model =>
    class extends Model {
      static properties = {
        type: {
          type: 'string',
          required: true
        },

        // The credentials of all user models share one table, so they refer to
        // their users by model name and id, without foreign keys:
        userModel: {
          type: 'string',
          required: true,
          unique: 'userModel_key'
        },

        userId: {
          type: 'string',
          required: true
        },

        // The credential id of passkeys, registered only once:
        key: {
          type: 'string',
          nullable: true,
          unique: 'userModel_key'
        },

        name: {
          type: 'string',
          nullable: true
        },

        data: {
          type: 'object',
          hidden: true
        },

        createdAt: {
          type: 'timestamp'
        },

        lastUsedAt: {
          type: 'timestamp',
          nullable: true
        }
      }

      static hooks = {
        'before:insert'({ inputItems }) {
          const now = new Date()
          for (const item of inputItems) {
            item.createdAt = now
          }
        }
      }
    }
)
