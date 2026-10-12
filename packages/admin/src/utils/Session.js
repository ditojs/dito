import { shallowRef } from 'vue'
import AdminUser from '../AdminUser.js'

// The views depend on the user, so we resolve them for each login and clear
// them once the user is logged out.

export class Session {
  #api
  #viewRegistry
  #redirectAfterLogin
  #userInterface = null
  /** @type {import('vue').ShallowRef<Record<string, any> | null>} */
  #user = shallowRef(null)
  // The responses of `request({ cache: 'global' })`, kept for the same user:
  /** @type {Record<string, Promise<any>>} */
  loadCache = {}

  constructor({ api, viewRegistry, redirectAfterLogin = null }) {
    this.#api = api
    this.#viewRegistry = viewRegistry
    this.#redirectAfterLogin = redirectAfterLogin
  }

  get user() {
    return this.#user.value
  }

  // `requestLoginData()` returns the credentials, or `null` when cancelled.
  attachUserInterface({ requestLoginData, notify }) {
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
  async login() {
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

  async logout() {
    try {
      const response = await this.#request(this.#api.users.logout)
      if (response.data.success) {
        this.#setUser(null)
      }
    } catch (error) {
      console.error(error)
    }
  }

  async fetchUser() {
    let user = null
    try {
      const response = await this.#request(this.#api.users.session)
      user = response.data.user || null
    } catch (error) {
      this.#notifyError(error)
    }
    this.#setUser(user)
    return user
  }

  async ensureUser() {
    if (!(await this.fetchUser())) {
      await this.login()
    }
  }

  #setUser(user) {
    if (!user || user.id !== this.user?.id) {
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

  #request(resource, data = null) {
    const url = this.#api.getApiUrl({ url: this.#api.resources.any(resource) })
    return this.#api.request({ method: resource.method, url, data })
  }

  #notifyError(error) {
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
