import type { ShallowRef } from 'vue'
import AdminUser from '../AdminUser.js'
import type { ViewRegistry } from './ViewRegistry.js'
import type { NotifyOptions } from './AdminContext.ts'
import type { Api } from './types.ts'

export type User = Record<string, any>

interface UserInterface {
  requestLoginData(): Promise<Record<string, any> | null>
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

  // `requestLoginData()` returns the credentials, or `null` when cancelled.
  attachUserInterface({ requestLoginData, notify }: UserInterface) {
    const userInterface = { requestLoginData, notify }
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
      const response = await this.#request(this.#api.users.login, loginData)
      user = response.data.user
    } catch (error) {
      this.#notifyError(error)
      return this.login()
    }
    if (this.#redirectAfterLogin) {
      location.replace(this.#redirectAfterLogin)
    } else {
      this.#setUser(user)
      await this.#resolveViews()
    }
    return user
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
