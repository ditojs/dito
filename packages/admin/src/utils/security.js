import { startRegistration } from '@simplewebauthn/browser'
import { isPasskeyPromptCancelled } from './Session.ts'

// Dialogs are as wide as their content, up to their `width` setting, so
// components as wide as the setting fill them:
const securityWidth = 600

// The Security dialog of the account menu, which changes the password and
// manages the passkeys of the logged-in user:
export function showSecurityDialog(adminContext, { passkeys }) {
  const { users } = adminContext.api
  const formatDate = ({ value, format }) =>
    value ? format(value, { date: true }) : 'Never'
  return adminContext.showDialog({
    components: {
      // The password itself is never shown, so render a placeholder:
      password: {
        type: 'object',
        label: 'Password',
        width: `${securityWidth}px`,
        render: () => '••••••••',
        buttons: {
          change: {
            text: 'Change',
            async onClick({ showDialog, request, notify }) {
              const data = await showDialog({
                components: {
                  currentPassword: {
                    type: 'password',
                    label: 'Current Password',
                    autocomplete: 'current-password',
                    required: true,
                    autofocus: true
                  },
                  password: {
                    type: 'password',
                    label: 'New Password',
                    autocomplete: 'new-password',
                    required: true
                  },
                  confirmation: {
                    type: 'password',
                    label: 'Confirm New Password',
                    autocomplete: 'new-password',
                    required: true,
                    validate: ({ value, item }) => (
                      value === item.password || 'must match the new password'
                    )
                  }
                },
                buttons: {
                  cancel: {},
                  change: { type: 'submit', text: 'Change Password' }
                },
                settings: { label: 'Change Password' }
              })
              if (data) {
                const { currentPassword, password } = data
                await request({
                  resource: users.password,
                  data: { currentPassword, password }
                })
                notify({ type: 'success', text: 'Your password was changed.' })
              }
            }
          }
        }
      },

      ...(passkeys && {
        passkeys: {
          type: 'list',
          label: 'Passkeys',
          width: `${securityWidth}px`,
          resource: users.passkeys,
          deletable: true,
          itemLabel: ({ item }) =>
            item.name === 'Passkey'
              ? 'the passkey'
              : `the ${item.name} passkey`,
          empty: 'No passkeys yet.',
          columns: {
            name: {},
            createdAt: { label: 'Created', render: formatDate },
            lastUsedAt: { label: 'Last Used', render: formatDate }
          },
          buttons: {
            add: {
              text: 'Add Passkey',
              // The server names passkeys after their providers:
              async onClick({ request, reload }) {
                const optionsJSON = await request({
                  resource: users.passkeyOptions
                })
                await request({
                  resource: users.passkeys,
                  method: 'post',
                  data: await startRegistration({ optionsJSON })
                })
                await reload()
              },

              // Cancelled passkey prompts end quietly:
              onError({ error }) {
                if (isPasskeyPromptCancelled(error)) {
                  return false
                }
              }
            }
          }
        }
      })
    },
    buttons: {
      cancel: { text: 'Close' }
    },
    // The password row has nothing to load, but objects need a value:
    data: { password: {} },
    settings: { label: 'Security', width: securityWidth }
  })
}
