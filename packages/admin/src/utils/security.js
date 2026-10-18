import { startRegistration } from '@simplewebauthn/browser'
import DitoQrCode from '../components/DitoQrCode.vue'
import { confirm } from './dialogs.js'

// Dialogs are as wide as their content, up to their `width` setting, so
// components as wide as the setting fill them:
const securityWidth = 600
const codeWidth = '360px'

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
      ...(authentication.hasPasswordChange && {
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
                    username: usernameComponent,
                    ...createNewPasswordComponents({ autofocus: true })
                  },
                  buttons: {
                    cancel: {},
                    change: { type: 'submit', text: 'Change Password' }
                  },
                  data: { username: adminContext.user.username },
                  settings: { label: 'Change Password' }
                })
                if (data) {
                  await request({
                    resource: users.password,
                    data: { password: data.password }
                  })
                  notify({
                    type: 'success',
                    text: 'Your password was changed.'
                  })
                }
              }
            }
          }
        }
      }),

      ...(authentication.hasPasskeys && {
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

      ...(authentication.hasTotp && {
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
    // The password row has nothing to load, but objects need a value:
    data: authentication.hasPasswordChange ? { password: {} } : {},
    settings: { label: 'Security', width: securityWidth }
  })
}

// The login dialog resolves to the credentials, to `'passkey'` to log in with a
// passkey, or to `'passwordReset'` to reset the password:
export function createLoginDialog(authentication, additionalComponents = {}) {
  return {
    components: {
      username: {
        type: 'text',
        autofocus: true
      },
      password: {
        type: 'password'
      },
      ...additionalComponents
    },
    // NOTE: Login comes first in DOM order for password managers, CSS places
    // cancel first:
    buttons: {
      login: {
        type: 'submit',
        text: 'Sign In'
      },

      ...createPasskeyButtons(authentication, 'Sign In with Passkey'),

      ...(authentication.hasPasswordReset && {
        passwordReset: {
          type: 'button',
          text: 'Forgot password?',
          onClick: ({ closeDialog }) => closeDialog('passwordReset')
        }
      }),

      // `DitoDialog` adds the click event of the cancel button:
      cancel: {
        type: 'button',
        text: 'Cancel'
      }
    }
  }
}

// The code of users with TOTP, when logging in and when confirming the access:
export function createCodeDialog() {
  return {
    components: {
      code: {
        type: 'text',
        label: 'Authentication Code',
        info: 'Enter the code from your authenticator app, or a backup code.',
        placeholder: '123456',
        autocomplete: 'one-time-code',
        autofocus: true,
        width: codeWidth
      }
    },
    buttons: {
      verify: {
        type: 'submit',
        text: 'Verify'
      },

      cancel: {
        type: 'button',
        text: 'Cancel'
      }
    },
    // Show password managers filling in the code:
    settings: { minDuration: 1000 }
  }
}

// The username to reset the password of:
export function createPasswordResetDialog() {
  return {
    components: {
      username: {
        type: 'text',
        autocomplete: 'username',
        autofocus: true,
        required: true
      }
    },
    buttons: {
      send: {
        type: 'submit',
        text: 'Send Email'
      },

      cancel: {
        type: 'button',
        text: 'Cancel'
      }
    },
    settings: { label: 'Reset Password' }
  }
}

// The new password of a password reset:
export function createNewPasswordDialog() {
  return {
    components: createNewPasswordComponents({ autofocus: true }),
    buttons: {
      change: {
        type: 'submit',
        text: 'Set Password'
      },

      cancel: {
        type: 'button',
        text: 'Cancel'
      }
    },
    settings: { label: 'Set New Password' }
  }
}

// The confirm access dialog resolves to the password, or to `'passkey'` to
// confirm the access with a passkey:
export function createConfirmAccessDialog(authentication, user) {
  return {
    components: {
      username: usernameComponent,
      password: {
        type: 'password',
        label: 'Password',
        info: 'Confirm your access to change your security settings.',
        autocomplete: 'current-password',
        autofocus: true,
        required: true
      }
    },
    buttons: {
      confirm: {
        type: 'submit',
        text: 'Confirm'
      },

      ...createPasskeyButtons(authentication, 'Use Passkey'),

      cancel: {
        type: 'button',
        text: 'Cancel'
      }
    },
    data: { username: user.username },
    settings: { label: 'Confirm Access' }
  }
}

// Password managers need the username of password dialogs to know whose
// password it is, so dialogs about the logged-in user pass it on hidden:
const usernameComponent = {
  type: 'text',
  autocomplete: 'username',
  readonly: true,
  visible: false
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

// Browsers reject passkey prompts that users cancel or let time out with these
// WebAuthn errors:
export function isPasskeyPromptCancelled(error) {
  return ['NotAllowedError', 'AbortError'].includes(error.name)
}

// The button that closes the dialog with `'passkey'`, to be spread into the
// buttons, only in browsers with WebAuthn, which have `PublicKeyCredential`:
function createPasskeyButtons({ hasPasskeys }, text) {
  const shouldOfferPasskeys = hasPasskeys && !!window.PublicKeyCredential
  return (
    shouldOfferPasskeys && {
      passkey: {
        type: 'button',
        text,
        onClick: ({ closeDialog }) => closeDialog('passkey')
      }
    }
  )
}

// Two codes per line:
function formatBackupCodes(codes) {
  return codes
    .map((code, index) => (index % 2 ? ` ${code}\n` : code))
    .join('')
    .trim()
}
