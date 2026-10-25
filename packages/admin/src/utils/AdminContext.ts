import { computed, shallowReactive, shallowRef } from 'vue'
import type { Html } from '@ditojs/utils'
import type { Router } from 'vue-router'
import { LoadingTracker } from './LoadingTracker.ts'
import type { RouteContext } from './RouteContext.ts'
import { flattenViews } from './schema/setup.js'
import { confirm, prompt, alert } from './dialogs.js'
import type { RouteTree } from './RouteTree.ts'
import { Session, type User, type LoginOptions } from './Session.ts'
import type { ViewRegistry } from './ViewRegistry.js'
import type { Api, Schema } from './types.ts'
import type { AdminContext as PublicAdminContext } from '../../types/index.d.ts'

export interface DialogOptions {
  fields?: Record<string, Schema>
  buttons?: Record<string, Schema>
  data?: Record<string, any>
  settings?: {
    label?: string
    width?: number | string
    minWidth?: number | string
    clickToClose?: boolean
    minDuration?: number
  }
}

export type NotifyOptions = Parameters<PublicAdminContext['notify']>[0]

// The authentication features that the server enables:
export interface Authentication {
  hasPasskeys?: boolean
  hasTotp?: boolean
  hasPasswordChange?: boolean
  hasPasswordReset?: boolean
}

// Rendered by `DitoRoot`:
export interface DialogsAndNotifications {
  // Dialogs resolve to their data, to the value of `closeDialog()`, or to
  // `undefined` when cancelled:
  showDialog<$Result = unknown>(
    options: DialogOptions
  ): Promise<$Result | undefined>
  notify(options: NotifyOptions): void
}

// The user and the views change with each login, and are read reactively:
export class AdminContext {
  readonly api: Api
  readonly router: Router
  readonly settings: Record<string, any>
  readonly authentication: Authentication
  readonly session: Session
  readonly #user = shallowRef<User | null>(null)
  readonly title = document.title || 'Dito.js Admin'
  // The pending requests of the admin, for the header's spinner:
  readonly loadingTracker = new LoadingTracker()
  // The routes by level. Routes that are being left stay until they're
  // unmounted, or replaced by the ones of the new route:
  readonly routes = shallowReactive<RouteContext[]>([])
  readonly #viewRegistry: ViewRegistry
  readonly #flattenedViews = computed(() => flattenViews(this.views))
  #dialogsAndNotifications: DialogsAndNotifications | null = null

  constructor({
    api,
    router,
    viewRegistry,
    settings,
    authentication,
    login
  }: {
    api: Api
    router: Router
    viewRegistry: ViewRegistry
    settings: Record<string, any>
    authentication: Authentication
    login?: LoginOptions
  }) {
    this.api = api
    this.router = router
    this.settings = settings
    this.authentication = authentication
    this.session = new Session({
      adminContext: this,
      viewRegistry,
      user: this.#user,
      login
    })
    this.#viewRegistry = viewRegistry
  }

  get user(): User | null {
    return this.#user.value
  }

  get isWidePage(): boolean {
    return this.routes.some(route => route.isActive && route.isWide)
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

  showDialog<$Result = unknown>(options: DialogOptions) {
    return this.#dialogsAndNotifications!.showDialog<$Result>(options)
  }

  confirm(
    message: string | Html,
    options?: { action?: string }
  ): Promise<boolean> {
    return confirm({ adminContext: this }, message, options)
  }

  prompt(
    message: string | Html,
    options?: { action?: string; value?: any; type?: string }
  ): Promise<unknown> {
    return prompt({ adminContext: this }, message, options)
  }

  alert(
    message: string | Html,
    options?: { action?: string }
  ): Promise<void> {
    return alert({ adminContext: this }, message, options)
  }

  notify(options: NotifyOptions) {
    this.#dialogsAndNotifications!.notify(options)
  }
}
