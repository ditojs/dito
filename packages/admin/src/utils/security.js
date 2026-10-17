import { startRegistration } from '@simplewebauthn/browser'
import DitoQrCode from '../components/DitoQrCode.vue'
import { isPasskeyPromptCancelled } from './Session.ts'

// Dialogs are as wide as their content, up to their `width` setting, so
// components as wide as the setting fill them:
const securityWidth = 600
const codeWidth = '360px'

// The Security dialog of the account menu, which changes the password and
// manages the passkeys and the TOTP of the logged-in user:
export function showSecurityDialog(adminContext, { passkeys, totp }) {
  const { users } = adminContext.api
  const formatDate = ({ value, format }) =>
    value ? format(value, { date: true }) : 'Never'

  // Ask for a code with `dialog` until `submit(code)` accepts it, or resolve
  // to `null` when the dialog is cancelled or the submit fails otherwise, e.g.
  // after too many attempts or when the setup expired:
  const submitCode = async (context, dialog, submit) => {
    const data = await context.showDialog(dialog)
    if (data) {
      try {
        return await submit(data.code)
      } catch (error) {
        context.notify({ type: 'error', error, text: error.message })
        // Wrong codes answer 401:
        return error.status === 401
          ? submitCode(context, dialog, submit)
          : null
      }
    } else {
      return null
    }
  }

  return adminContext.showDialog({
    components: {
      password: {
        type: 'section',
        label: 'Password',
        components: {
          changePassword: {
            type: 'button',
            text: 'Change Password',
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
                  ...createNewPasswordComponents()
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
      }),

      ...(totp && {
        totp: {
          type: 'object',
          label: 'Two-Factor Authentication',
          width: `${securityWidth}px`,
          resource: users.totp,
          render: ({ item }) =>
            item.enabled
              ? `Enabled · ${item.backupCodes} backup codes left`
              : 'Not set up',
          buttons: {
            setUp: {
              text: 'Set Up',
              if: ({ item }) => !item.enabled,
              async onClick(context) {
                const { request, showDialog, reload } = context
                const { uri, secret } = await request({
                  resource: users.totp,
                  method: 'post'
                })
                const result = await submitCode(
                  context,
                  {
                    components: {
                      uri: {
                        type: 'component',
                        component: DitoQrCode,
                        label: 'Scan the QR code with your authenticator app'
                      },
                      secret: {
                        type: 'text',
                        label: 'Or enter the key',
                        readonly: true
                      },
                      code: {
                        type: 'text',
                        label: 'Authentication Code',
                        placeholder: '123456',
                        autocomplete: 'one-time-code',
                        autofocus: true,
                        width: codeWidth
                      }
                    },
                    buttons: {
                      cancel: {},
                      turnOn: { type: 'submit', text: 'Turn On' }
                    },
                    // Group the key for reading:
                    data: { uri, secret: secret.match(/.{1,4}/g).join(' ') },
                    settings: { label: 'Set Up Two-Factor Authentication' }
                  },
                  code =>
                    request({ resource: users.totpConfirm, data: { code } })
                )
                if (result) {
                  // The codes are stored hashed, so they're only shown now:
                  await showDialog({
                    components: {
                      backupCodes: {
                        type: 'textarea',
                        label: 'Store these backup codes in a safe place',
                        info: (
                          'Each code logs you in once, instead of a code ' +
                          'from your authenticator app.\nThey are only ' +
                          'shown now.'
                        ),
                        width: codeWidth,
                        readonly: true,
                        lines: 5
                      }
                    },
                    buttons: {
                      done: { type: 'submit', text: 'Done' }
                    },
                    data: {
                      backupCodes: formatBackupCodes(result.backupCodes)
                    },
                    settings: { label: 'Backup Codes' }
                  })
                  await reload()
                }
              }
            },

            turnOff: {
              text: 'Turn Off',
              if: ({ item }) => item.enabled,
              async onClick(context) {
                const { request, reload } = context
                const result = await submitCode(
                  context,
                  {
                    components: { code: createCodeComponent() },
                    buttons: {
                      cancel: {},
                      turnOff: { type: 'submit', text: 'Turn Off' }
                    },
                    settings: { label: 'Turn Off Two-Factor Authentication' }
                  },
                  code =>
                    request({
                      resource: users.totp,
                      method: 'delete',
                      data: { code }
                    })
                )
                if (result) {
                  await reload()
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

// The code field of the login and the security dialogs:
export function createCodeComponent() {
  return {
    type: 'text',
    label: 'Authentication Code',
    info: 'Enter the code from your authenticator app, or a backup code.',
    placeholder: '123456',
    autocomplete: 'one-time-code',
    autofocus: true,
    width: codeWidth
  }
}

// The new password and its confirmation, of the Security dialog and of password
// resets:
export function createNewPasswordComponents({ autofocus = false } = {}) {
  return {
    password: {
      type: 'password',
      label: 'New Password',
      autocomplete: 'new-password',
      autofocus,
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
  }
}

// Two codes per line:
function formatBackupCodes(codes) {
  return codes
    .map((code, index) => (index % 2 ? ` ${code}\n` : code))
    .join('')
    .trim()
}
