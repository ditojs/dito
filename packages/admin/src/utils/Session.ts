import type { ShallowRef } from 'vue'
import { startAuthentication } from '@simplewebauthn/browser'
import AdminUser from '../AdminUser.js'
import type { ViewRegistry } from './ViewRegistry.js'
import type { NotifyOptions } from './AdminContext.ts'
import type { Api } from './types.ts'

export type User = Record<string, any>

interface UserInterface {
  requestLoginData(): Promise<Record<string, any> | 'passkey' | null>
  requestLoginCode(): Promise<{ code: string } | null>
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
  // passkey, or `null` when cancelled. `requestLoginCode()` returns the TOTP or
  // backup code of users with TOTP, or `null` when cancelled.
  attachUserInterface({
    requestLoginData,
    requestLoginCode,
    notify
  }: UserInterface) {
    const userInterface = { requestLoginData, requestLoginCode, notify }
    this.#userInterface = userInterface
    return () => {
      if (this.#userInterface === userInterface) {
        this.#userInterface = null
      }
    }
  }

  async start() {
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
    }
    let user
    try {
      const { users } = this.#api
      let response
      if (loginData === 'passkey') {
        const options = await this.#request(users.passkeyLoginOptions)
        const passkey = await startAuthentication({ optionsJSON: options.data })
        response = await this.#request(users.passkeyLogin, passkey)
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
        // Wrong codes answer 401, missing or expired logins 400:
        return error.response?.status === 401 ? this.#loginWithCode() : null
      }
    } else {
      return null
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

  #request(resource: any, data: any = null) {
    const url = this.#api.getApiUrl({ url: this.#api.resources.any(resource) })
    return this.#api.request<any>({ method: resource.method, url, data })
  }

  #notifyError(error: any) {
    const responseError = error.response?.data?.error || error
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
