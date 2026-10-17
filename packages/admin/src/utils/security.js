import { startRegistration } from '@simplewebauthn/browser'
import { isPasskeyPromptCancelled } from './Session.ts'

// Dialogs are as wide as their content, up to their `width` setting, so
// components as wide as the setting fill them:
const securityWidth = 600

// The Security dialog of the account menu, which manages the passkeys of the
// logged-in user:
export function showSecurityDialog(adminContext, { passkeys }) {
  const { users } = adminContext.api
  const formatDate = ({ value, format }) =>
    value ? format(value, { date: true }) : 'Never'
  return adminContext.showDialog({
    components: {
      ...(passkeys && {
        passkeys: {
          type: 'list',
          label: 'Passkeys',
          width: `${securityWidth}px`,
          resource: users.passkeys,
          deletable: true,
          columns: {
            name: {},
            createdAt: { label: 'Created', render: formatDate },
            lastUsedAt: { label: 'Last Used', render: formatDate }
          },
          buttons: {
            add: {
              text: 'Add Passkey',
              async onClick({ showDialog, request, reload }) {
                const data = await showDialog({
                  components: {
                    // Keep password managers from filling in the name:
                    name: { type: 'text', autocomplete: 'off', autofocus: true }
                  },
                  // Cancel comes first, to be focused first:
                  buttons: {
                    cancel: {},
                    add: { type: 'submit', text: 'Add' }
                  },
                  settings: { label: 'Add Passkey' }
                })
                if (data) {
                  const optionsJSON = await request({
                    resource: users.passkeyOptions
                  })
                  const response = await startRegistration({ optionsJSON })
                  await request({
                    resource: users.passkeys,
                    method: 'post',
                    data: { name: data.name, response }
                  })
                  await reload()
                }
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
    settings: { label: 'Security', width: securityWidth }
  })
}
