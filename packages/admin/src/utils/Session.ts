import type { ShallowRef } from 'vue'
import { startAuthentication } from '@simplewebauthn/browser'
import AdminUser from '../AdminUser.js'
import type { ViewRegistry } from './ViewRegistry.js'
import type { NotifyOptions } from './AdminContext.ts'
import type { Api } from './types.ts'

export type User = Record<string, any>

interface UserInterface {
  requestLoginData(): Promise<
    Record<string, any> | 'passkey' | 'passwordReset' | null
  >
  requestLoginCode(): Promise<{ code: string } | null>
  requestPasswordReset(): Promise<Record<string, any> | null>
  requestNewPassword(): Promise<{ password: string } | null>
  requestAccessConfirmation(): Promise<{ password: string } | 'passkey' | null>
  notify(options: NotifyOptions): void
}

// The views depend on the user, so we resolve them for each login and clear
// them once the user is logged out. The session sets the user that the admin
// context hands out.

export class Session {
  readonly #api: Api
  readonly #viewRegistry: ViewRegistry
  readonly #redirectAfterLogin: string | null
  #userInterface: UserInterface | null = null
  readonly #user: ShallowRef<User | null>
  // The responses of `request({ cache: 'global' })`, kept for the same user:
  loadCache: Record<string, Promise<any>> = {}

  constructor({
    api,
    viewRegistry,
    user,
    redirectAfterLogin = null
  }: {
    api: Api
    viewRegistry: ViewRegistry
    user: ShallowRef<User | null>
    redirectAfterLogin?: string | null
  }) {
    this.#api = api
    this.#viewRegistry = viewRegistry
    this.#user = user
    this.#redirectAfterLogin = redirectAfterLogin
  }

  // `requestLoginData()` returns the credentials, `'passkey'` to log in with a
  // passkey, `'passwordReset'` to reset the password, or `null` when cancelled.
  // `requestLoginCode()` returns the TOTP or backup code of users with TOTP,
  // `requestPasswordReset()` the username to reset the password of,
  // `requestNewPassword()` the new password, and `requestAccessConfirmation()`
  // the password or `'passkey'` to confirm the access with, or `null` when
  // cancelled.
  attachUserInterface({
    requestLoginData,
    requestLoginCode,
    requestPasswordReset,
    requestNewPassword,
    requestAccessConfirmation,
    notify
  }: UserInterface) {
    const userInterface = {
      requestLoginData,
      requestLoginCode,
      requestPasswordReset,
      requestNewPassword,
      requestAccessConfirmation,
      notify
    }
    this.#userInterface = userInterface
    return () => {
      if (this.#userInterface === userInterface) {
        this.#userInterface = null
      }
    }
  }

  async start() {
    // The link of password reset emails opens the admin with the token in the
    // fragment, which browsers don't send to servers:
    const url = new URL(location.href)
    const token = new URLSearchParams(url.hash.slice(1)).get('password-reset')
    if (token) {
      await this.#confirmPasswordReset(token)
      url.hash = ''
      history.replaceState(history.state, '', url)
    }
    if (await this.fetchUser()) {
      await this.#resolveViews()
    } else {
      await this.login()
    }
  }

  // Ask again after each failure, until it succeeds or the user cancels:
  async login(): Promise<User | null> {
    const loginData = await this.#userInterface?.requestLoginData()
    if (!loginData) {
      return null
    } else if (loginData === 'passwordReset') {
      await this.#requestPasswordReset()
      return this.login()
    }
    let user
    try {
      const { users } = this.#api
      let response
      if (loginData === 'passkey') {
        response = await this.#request(
          users.passkeyLogin,
          await this.#getPasskey()
        )
      } else {
        response = await this.#request(users.login, loginData)
      }
      user = response.data.codeRequired
        ? await this.#loginWithCode()
        : response.data.user
    } catch (error) {
      // Ask again quietly when the passkey prompt is cancelled:
      if (!isPasskeyPromptCancelled(error)) {
        this.#notifyError(error)
      }
      return this.login()
    }
    if (user) {
      if (this.#redirectAfterLogin) {
        location.replace(this.#redirectAfterLogin)
      } else {
        this.#setUser(user)
        await this.#resolveViews()
      }
      return user
    } else {
      // The code step was cancelled or has expired, so ask for the password:
      return this.login()
    }
  }

  // Ask for the code of users with TOTP until it's accepted, or resolve to
  // `null` to go back to the password:
  async #loginWithCode(): Promise<User | null> {
    const codeData = await this.#userInterface?.requestLoginCode()
    if (codeData) {
      try {
        const response = await this.#request(
          this.#api.users.loginCode,
          codeData
        )
        return response.data.user
      } catch (error: any) {
        this.#notifyError(error)
        // Wrong codes answer 401, missing or expired logins and too many
        // attempts 400:
        return error.response?.status === 401 ? this.#loginWithCode() : null
      }
    } else {
      return null
    }
  }

  // Security changes need a recent login, or a confirmation of the access with
  // the password and the code of users with TOTP, or with a passkey. Ask again
  // after each failure, and resolve to whether the access was confirmed:
  async confirmAccess(): Promise<boolean> {
    const data = await this.#userInterface?.requestAccessConfirmation()
    if (data) {
      try {
        const { users } = this.#api
        const body =
          data === 'passkey' ? { passkey: await this.#getPasskey() } : data
        let response = await this.#request(users.confirmAccess, body)
        if (response.data.codeRequired) {
          const codeData = await this.#userInterface?.requestLoginCode()
          if (codeData) {
            response = await this.#request(users.confirmAccess, {
              ...body,
              ...codeData
            })
          } else {
            // Cancelling the code ends the confirmation, like the password:
            return false
          }
        }
        if (response.data.success) {
          return true
        }
      } catch (error) {
        if (!isPasskeyPromptCancelled(error)) {
          this.#notifyError(error)
        }
      }
      return this.confirmAccess()
    } else {
      return false
    }
  }

  async #requestPasswordReset() {
    const data = await this.#userInterface?.requestPasswordReset()
    if (data) {
      try {
        await this.#request(this.#api.users.passwordReset, data)
        // The server doesn't tell whether the account exists:
        this.#userInterface?.notify({
          type: 'info',
          text: 'If the account exists, we sent you an email.'
        })
      } catch (error) {
        this.#notifyError(error)
      }
    }
  }

  async #confirmPasswordReset(token: string) {
    const data = await this.#userInterface?.requestNewPassword()
    if (data) {
      try {
        await this.#request(this.#api.users.passwordResetConfirm, {
          token,
          password: data.password
        })
        this.#userInterface?.notify({
          type: 'success',
          text: 'Your password was changed. Please log in.'
        })
      } catch (error: any) {
        // Ask again with the same token for invalid passwords:
        const errors: Record<string, { message: string }[]> | undefined =
          error.response?.data?.errors
        if (errors) {
          this.#userInterface?.notify({
            type: 'error',
            title: 'Invalid Password',
            text: Object.entries(errors).flatMap(([path, errs]) =>
              errs.map(({ message }) => `${path} ${message}`)
            )
          })
          await this.#confirmPasswordReset(token)
        } else {
          this.#notifyError(error)
        }
      }
    }
  }

  // Resolve to whether the user was logged out:
  async logout(): Promise<boolean> {
    try {
      const response = await this.#request(this.#api.users.logout)
      if (response.data.success) {
        this.#setUser(null)
        return true
      }
    } catch (error) {
      console.error(error)
    }
    return false
  }

  async fetchUser() {
    let user: User | null = null
    try {
      const response = await this.#request(this.#api.users.session)
      user = response.data.user || null
    } catch (error) {
      this.#notifyError(error)
    }
    this.#setUser(user)
    return user
  }

  async ensureUser(): Promise<User | null> {
    return (await this.fetchUser()) || this.login()
  }

  #setUser(user: User | null) {
    if (!user || user.id !== this.#user.value?.id) {
      this.loadCache = {}
    }
    this.#user.value = user && Object.setPrototypeOf(user, AdminUser.prototype)
    if (!user) {
      this.#viewRegistry.clear()
    }
  }

  // Log in again if the views can't be resolved, e.g. as the API refuses the
  // user:
  async #resolveViews() {
    if (!(await this.#viewRegistry.resolve())) {
      await this.login()
    }
  }

  // Answer a challenge of the server with a passkey of the browser:
  async #getPasskey() {
    const options = await this.#request(this.#api.users.passkeyLoginOptions)
    return startAuthentication({ optionsJSON: options.data })
  }

  #request(resource: any, data: any = null) {
    const url = this.#api.getApiUrl({ url: this.#api.resources.any(resource) })
    return this.#api.request<any>({ method: resource.method, url, data })
  }

  #notifyError(error: any) {
    // Logins answer their errors in `error`, other actions in `message`:
    const { data } = error.response ?? {}
    const responseError = data?.error || data?.message || error
    if (this.#userInterface) {
      this.#userInterface.notify({
        type: 'error',
        error: responseError,
        title: 'Authentication Error',
        text: responseError
      })
    } else {
      console.error(responseError)
    }
  }
}

// Browsers reject passkey prompts that users cancel or let time out with these
// WebAuthn errors:
export function isPasskeyPromptCancelled(error: any) {
  return ['NotAllowedError', 'AbortError'].includes(error.name)
}
