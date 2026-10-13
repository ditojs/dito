import { computed, shallowRef } from 'vue'
import type { Router } from 'vue-router'
import { LoadingTracker } from './LoadingTracker.ts'
import { UiRegistry } from './UiRegistry.ts'
import { flattenViews } from './schema/setup.js'
import type { RouteTree } from './RouteTree.ts'
import { Session, type User } from './Session.ts'
import type { ViewRegistry } from './ViewRegistry.js'
import type { Api, Schema } from './types.ts'

export interface DialogOptions {
  components?: Record<string, Schema>
  buttons?: Record<string, Schema>
  data?: Record<string, any>
  settings?: {
    label?: string
    width?: number
    clickToClose?: boolean
  }
}

export interface NotifyOptions {
  type?: string
  title?: string
  text?: string | string[]
  html?: string | (string | false | null | undefined)[]
  error?: unknown
  duration?: number
}

// Rendered by `DitoRoot`:
export interface DialogsAndNotifications {
  showDialog(options: DialogOptions): Promise<unknown>
  notify(options: NotifyOptions): void
}

// The user and the views change with each login, and are read reactively:
export class AdminContext {
  readonly api: Api
  readonly router: Router
  readonly settings: Record<string, any>
  readonly session: Session
  readonly #user = shallowRef<User | null>(null)
  readonly title = document.title || 'Dito.js Admin'
  // The pending requests of the admin, for the header's spinner:
  readonly loadingTracker = new LoadingTracker()
  readonly ui = new UiRegistry()
  readonly #viewRegistry: ViewRegistry
  readonly #flattenedViews = computed(() => flattenViews(this.views))
  // Set by the schemas of wide views and forms:
  readonly #pageClass = shallowRef<string | null>(null)
  #dialogsAndNotifications: DialogsAndNotifications | null = null

  constructor({
    api,
    router,
    viewRegistry,
    settings,
    redirectAfterLogin
  }: {
    api: Api
    router: Router
    viewRegistry: ViewRegistry
    settings: Record<string, any>
    redirectAfterLogin?: string | null
  }) {
    this.api = api
    this.router = router
    this.settings = settings
    this.session = new Session({
      api,
      viewRegistry,
      user: this.#user,
      redirectAfterLogin
    })
    this.#viewRegistry = viewRegistry
  }

  get user(): User | null {
    return this.#user.value
  }

  get pageClass(): string | null {
    return this.#pageClass.value
  }

  set pageClass(pageClass: string | null) {
    this.#pageClass.value = pageClass
  }

  get routeTree(): RouteTree | null {
    return this.#viewRegistry.routeTree
  }

  get views(): Record<string, Schema> {
    return this.#viewRegistry.views
  }

  get flattenedViews(): Record<string, Schema> {
    return this.#flattenedViews.value
  }

  attachDialogsAndNotifications(
    dialogsAndNotifications: DialogsAndNotifications
  ) {
    this.#dialogsAndNotifications = dialogsAndNotifications
  }

  showDialog(options: DialogOptions) {
    return this.#dialogsAndNotifications!.showDialog(options)
  }

  notify(options: NotifyOptions) {
    this.#dialogsAndNotifications!.notify(options)
  }
}
