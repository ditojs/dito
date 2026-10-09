import appState from '../appState.js'
import DitoUser from '../DitoUser.js'

// Session holds the logged in user of the admin, see `user`, and logs users in
// and out through the `api.users` resources. The views depend on the user, so
// the session resolves them for each login and clears them once the user is
// logged out, see `ViewRegistry`.
//
// Logging in asks for the credentials through the user interface that the
// admin's root component attaches, see `attachUserInterface()`, which also
// notifies of authentication errors.

export class Session {
  #api
  #viewRegistry
  #redirectAfterLogin
  #userInterface = null

  constructor({ api, viewRegistry, redirectAfterLogin = null }) {
    this.#api = api
    this.#viewRegistry = viewRegistry
    this.#redirectAfterLogin = redirectAfterLogin
  }

  // The logged in user, or `null`. Reactive, as it's kept in the app state.
  get user() {
    return appState.user
  }

  // Attaches the user interface of the session:
  // - `requestLoginData()` asks for the credentials, and returns them, or
  //   `null` if the user cancels.
  // - `notify(options)` shows a notification.
  // Returns the function that detaches it again.
  attachUserInterface({ requestLoginData, notify }) {
    const userInterface = { requestLoginData, notify }
    this.#userInterface = userInterface
    return () => {
      if (this.#userInterface === userInterface) {
        this.#userInterface = null
      }
    }
  }

  // Starts the session with the user of the server's session if there is one,
  // or else asks to log in.
  async start() {
    if (await this.fetchUser()) {
      await this.#resolveViews()
    } else {
      await this.login()
    }
  }

  // Asks for the credentials and logs in with them, again after each failure,
  // until it succeeds or the user cancels. Returns the user, or `null`.
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

  // Fetches the user of the server's session, and returns it, or `null` if
  // there is none, e.g. as the session expired.
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

  // Makes sure that a user is logged in before requesting the API, and asks to
  // log in if the session expired.
  async ensureUser() {
    if (!(await this.fetchUser())) {
      await this.login()
    }
  }

  #setUser(user) {
    appState.user = user && Object.setPrototypeOf(user, DitoUser.prototype)
    if (!user) {
      this.#viewRegistry.clear()
    }
  }

  // Resolves the views for the logged in user, and asks to log in again if
  // they can't be resolved, e.g. as the API refuses the user.
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
