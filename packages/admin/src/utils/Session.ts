import type { ShallowRef } from 'vue'
import { startAuthentication } from '@simplewebauthn/browser'
import AdminUser from '../AdminUser.js'
import {
  createLoginDialog,
  createCodeDialog,
  createPasswordResetDialog,
  createNewPasswordDialog,
  createConfirmAccessDialog,
  createInvalidPasswordNotification,
  isPasskeyPromptCancelled
} from './security.js'
import type { ViewRegistry } from './ViewRegistry.js'
import type { AdminContext } from './AdminContext.ts'
import type { Api } from './types.ts'
import type { RequestMethodResponse } from '../../types/index.d.ts'

export type User = Record<string, any>

// The `login` options of the admin:
export interface LoginOptions {
  additionalComponents?: Record<string, any>
  redirectAfterLogin?: string
}

// The views depend on the user, so we resolve them for each login and clear
// them once the user is logged out. The session sets the user that the admin
// context hands out.

export class Session {
  readonly #adminContext: AdminContext
  readonly #api: Api
  readonly #viewRegistry: ViewRegistry
  readonly #login: LoginOptions
  readonly #user: ShallowRef<User | null>
  // The responses of `request({ cache: 'global' })`, kept for the same user:
  loadCache: Record<string, Promise<any>> = {}

  constructor({
    adminContext,
    viewRegistry,
    user,
    login = {}
  }: {
    adminContext: AdminContext
    viewRegistry: ViewRegistry
    user: ShallowRef<User | null>
    login?: LoginOptions
  }) {
    this.#adminContext = adminContext
    this.#api = adminContext.api
    this.#viewRegistry = viewRegistry
    this.#user = user
    this.#login = login
  }

  async start() {
    // The link of password reset emails opens the admin with the token in the
    // fragment, which browsers don't send to servers:
    const params = new URLSearchParams(location.hash.slice(1))
    const token = params.get('password-reset')
    if (token) {
      await this.#confirmPasswordReset(token)
      // Remove the token through the router, which would otherwise restore it
      // with its next navigation:
      const { router } = this.#adminContext
      const { path, query } = router.currentRoute.value
      await router.replace({ path, query })
    }
    if (await this.fetchUser()) {
      await this.#resolveViews()
    } else {
      await this.login()
    }
  }

  // Ask again after each failure, until it succeeds or the user cancels:
  async login(): Promise<User | null> {
    const loginData = await this.#adminContext.showDialog<
      Record<string, any> | 'passkey' | 'passwordReset'
    >(
      createLoginDialog(
        this.#adminContext.authentication,
        this.#login.additionalComponents
      )
    )
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
        ? (await this.#requestWithCode(users.loginCode))?.data.user
        : response.data.user
    } catch (error) {
      // Ask again quietly when the passkey prompt is cancelled:
      if (!isPasskeyPromptCancelled(error)) {
        this.#notifyError(error)
      }
      return this.login()
    }
    if (user) {
      const { redirectAfterLogin } = this.#login
      if (redirectAfterLogin) {
        location.replace(redirectAfterLogin)
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

  // Ask for the code of users with TOTP until it's accepted, and send it with
  // `data` to `resource`. Resolve to the response, or to `null` when the code
  // is cancelled or no longer accepted:
  async #requestWithCode(
    resource: any,
    data: Record<string, any> = {}
  ): Promise<RequestMethodResponse<any> | null> {
    const codeData = await this.#adminContext.showDialog<{ code: string }>(
      createCodeDialog()
    )
    if (codeData) {
      try {
        return await this.#request(resource, { ...data, ...codeData })
      } catch (error: any) {
        this.#notifyError(error)
        // Wrong codes answer 401, missing or expired logins and too many
        // attempts 400:
        return error.response?.status === 401
          ? this.#requestWithCode(resource, data)
          : null
      }
    } else {
      return null
    }
  }

  // Security changes need a recent login, or a confirmation of the access with
  // the password and the code of users with TOTP, or with a passkey. Ask again
  // after each failure, and resolve to whether the access was confirmed:
  async confirmAccess(): Promise<boolean> {
    const data = await this.#adminContext.showDialog<
      { password: string } | 'passkey'
    >(
      createConfirmAccessDialog(
        this.#adminContext.authentication,
        this.#adminContext.user
      )
    )
    if (data) {
      try {
        const { users } = this.#api
        const body =
          data === 'passkey'
            ? { passkey: await this.#getPasskey() }
            : { password: data.password }
        const response = await this.#request(users.confirmAccess, body)
        if (response.data.codeRequired) {
          // Cancelling the code ends the confirmation, like the password, and
          // so do expired logins and too many attempts:
          const codeResponse = await this.#requestWithCode(
            users.confirmAccess,
            body
          )
          return !!codeResponse?.data.success
        } else if (response.data.success) {
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
    const data = await this.#adminContext.showDialog<{ username: string }>(
      createPasswordResetDialog()
    )
    if (data) {
      try {
        await this.#request(this.#api.users.passwordReset, data)
        // The server doesn't tell whether the account exists:
        this.#adminContext.notify({
          type: 'info',
          text: 'If the account exists, we sent you an email.'
        })
      } catch (error) {
        this.#notifyError(error)
      }
    }
  }

  async #confirmPasswordReset(token: string) {
    const data = await this.#adminContext.showDialog<{ password: string }>(
      createNewPasswordDialog()
    )
    if (data) {
      try {
        await this.#request(this.#api.users.passwordResetConfirm, {
          token,
          password: data.password
        })
        this.#adminContext.notify({
          type: 'success',
          text: 'Your password was changed. Please log in.'
        })
      } catch (error: any) {
        // Ask again with the same token for invalid passwords:
        const errors = error.response?.data?.errors
        if (errors) {
          this.#adminContext.notify(createInvalidPasswordNotification(errors))
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
    this.#adminContext.notify({
      type: 'error',
      error: responseError,
      title: 'Authentication Error',
      text: responseError
    })
  }
}
