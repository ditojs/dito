// The TOTP setup dialog fits the key:
export const codeWidth = '25em'

// Dialogs with short fields are at least this wide, so their labels fit:
export const minDialogWidth = '30em'

// Password managers need the username of password dialogs to know whose
// password it is, so dialogs about the logged-in user pass it on hidden:
export const usernameComponent = {
  type: 'text',
  autocomplete: 'username',
  readonly: true,
  visible: false
}

// The login dialog resolves to the credentials, to `'passkey'` to log in with a
// passkey, or to `'passwordReset'` to reset the password:
export function createLoginDialog(authentication, additionalFields = {}) {
  return {
    fields: {
      username: {
        type: 'text',
        autocomplete: 'username',
        autofocus: true
      },
      password: {
        type: 'password',
        autocomplete: 'current-password'
      },
      ...additionalFields
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
    fields: {
      code: {
        type: 'text',
        label: 'Authentication Code',
        info: 'Enter the code from your authenticator app, or a backup code.',
        placeholder: '123456',
        autocomplete: 'one-time-code',
        autofocus: true
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
    settings: { minDuration: 1000, minWidth: minDialogWidth }
  }
}

// The username to reset the password of:
export function createPasswordResetDialog() {
  return {
    fields: {
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
    fields: createNewPasswordComponents({ autofocus: true }),
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
    fields: {
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

// The notification of the validation errors of new passwords:
export function createInvalidPasswordNotification(errors) {
  return {
    type: 'error',
    title: 'Invalid Password',
    text: Object.entries(errors).flatMap(([path, errs]) =>
      errs.map(({ message }) => `${path} ${message}`)
    )
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
