import { computed } from 'vue'
import type { Router } from 'vue-router'
import { LoadingTracker } from './LoadingTracker.ts'
import { UiRegistry } from './UiRegistry.ts'
import { flattenViews } from './schema/setup.js'
import type { RouteTree } from './RouteTree.ts'
import type { Session } from './Session.js'
import type { ViewRegistry } from './ViewRegistry.js'
import type { Api, Schema } from './types.ts'

export interface DialogOptions {
  data?: Record<string, any>
  settings?: Record<string, any>
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
  showDialog(schema: Schema, options?: DialogOptions): Promise<unknown>
  notify(options: NotifyOptions): void
  closeNotifications(): void
}

// The user and the views change with each login, and are read reactively:
export class AdminContext {
  readonly api: Api
  readonly router: Router
  readonly session: Session
  // The pending requests of the admin, for the header's spinner:
  readonly loadingTracker = new LoadingTracker()
  readonly ui = new UiRegistry()
  readonly #viewRegistry: ViewRegistry
  readonly #flattenedViews = computed(() => flattenViews(this.views))
  #dialogsAndNotifications: DialogsAndNotifications | null = null

  constructor({
    api,
    router,
    session,
    viewRegistry
  }: {
    api: Api
    router: Router
    session: Session
    viewRegistry: ViewRegistry
  }) {
    this.api = api
    this.router = router
    this.session = session
    this.#viewRegistry = viewRegistry
  }

  get user() {
    return this.session.user
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

  showDialog(schema: Schema, options?: DialogOptions) {
    return this.#dialogsAndNotifications!.showDialog(schema, options)
  }

  notify(options: NotifyOptions) {
    this.#dialogsAndNotifications!.notify(options)
  }

  closeNotifications() {
    this.#dialogsAndNotifications!.closeNotifications()
  }
}
