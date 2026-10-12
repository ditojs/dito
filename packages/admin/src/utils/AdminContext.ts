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

// The dialogs and notifications that `DitoRoot` renders:
export interface DialogsAndNotifications {
  showDialog(schema: Schema, options?: DialogOptions): Promise<unknown>
  notify(options: NotifyOptions): void
  closeNotifications(): void
}

// The context of the admin, provided once to all its components. The user and
// the views change with each login, and are read reactively.
export class AdminContext {
  readonly api: Api
  readonly router: Router
  readonly session: Session
  // The pending requests of the admin, for the header's spinner:
  readonly loadingTracker = new LoadingTracker()
  // The rendered routes and components, to reveal and focus them:
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

  // The route tree of the resolved views, `null` until they're resolved.
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

  // Resolve with the value that the dialog is closed with:
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
