import { startRegistration } from '@simplewebauthn/browser'
import DitoQrCode from '../components/DitoQrCode.vue'
import { confirm } from '../utils/dialogs.js'
import {
  codeWidth,
  minDialogWidth,
  usernameComponent,
  createNewPasswordComponents,
  createInvalidPasswordNotification,
  isPasskeyPromptCancelled
} from './authentication.js'

// The Security dialog of the account menu, which changes the password and
// manages the passkeys and the TOTP of the logged-in user:
export function showSecurityDialog(adminContext) {
  const { api, authentication } = adminContext
  const { users } = api
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
        // Cancelled confirmations of the access end quietly:
        if (error.name !== 'AbortError') {
          context.notify({ type: 'error', error, text: error.message })
        }
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
      ...(authentication.hasPasswordChange && {
        // The password itself is never shown, only that there is one:
        password: {
          type: 'password',
          label: 'Password',
          placeholder: '••••••••',
          disabled: true,
          width: 'fill'
        },

        changePassword: {
          type: 'button',
          text: 'Change',
          width: 'auto',
          async onClick({ showDialog, request, notify }) {
            // Ask again for invalid passwords, like password resets:
            const changePassword = async () => {
              const data = await showDialog({
                components: {
                  username: usernameComponent,
                  ...createNewPasswordComponents({ autofocus: true })
                },
                buttons: {
                  cancel: {},
                  change: { type: 'submit', text: 'Change Password' }
                },
                data: { username: adminContext.user.username },
                settings: { label: 'Change Password', minWidth: minDialogWidth }
              })
              if (data) {
                try {
                  await request({
                    resource: users.password,
                    data: { password: data.password }
                  })
                  notify({
                    type: 'success',
                    text: 'Your password was changed.'
                  })
                } catch (error) {
                  if (error.errors) {
                    notify(createInvalidPasswordNotification(error.errors))
                    await changePassword()
                  } else {
                    throw error
                  }
                }
              }
            }
            await changePassword()
          }
        }
      }),

      ...(authentication.hasPasskeys && {
        passkeys: {
          type: 'list',
          label: 'Passkeys',
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

      ...(authentication.hasTotp && {
        totp: {
          type: 'object',
          label: 'Two-Factor Authentication',
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
                        autofocus: true
                      }
                    },
                    buttons: {
                      cancel: {},
                      turnOn: { type: 'submit', text: 'Turn On' }
                    },
                    // Group the key for reading:
                    data: { uri, secret: secret.match(/.{1,4}/g).join(' ') },
                    settings: {
                      label: 'Set Up Two-Factor Authentication',
                      width: codeWidth
                    }
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
                        readonly: true,
                        lines: 5,
                        // Textareas have no width of their own to size the
                        // dialog by:
                        width: minDialogWidth
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
              // Without confirmed access, requests ask for the code first:
              async onClick({ request, reload }) {
                const isConfirmed = await confirm(
                  { adminContext },
                  {
                    message: (
                      'Do you really want to turn off two-factor ' +
                      'authentication?'
                    ),
                    verb: 'turn off'
                  }
                )
                if (isConfirmed) {
                  await request({ resource: users.totp, method: 'delete' })
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
    settings: { label: 'Security', width: '46em', minWidth: minDialogWidth }
  })
}

// Two codes per line:
function formatBackupCodes(codes) {
  return codes
    .map((code, index) => (index % 2 ? ` ${code}\n` : code))
    .join('')
    .trim()
}
