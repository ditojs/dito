import type { DataModel } from './DataModel.ts'
import type { RouteContext } from './RouteContext.ts'
import type { Context } from './schema/types.ts'
import type { Resource, Schema } from './types.ts'

export interface SubmitOptions {
  validate?: boolean
  closeForm?: boolean
}

export interface ResourceOptions {
  method?: string
  child?: Resource | null
}

export interface SubmitButton {
  readonly schema: Schema
  readonly context: Context
  readonly closeForm: boolean
  createContext(values?: Record<string, any>): Context
  getSchemaValue(keyOrDataPath: string | string[], options?: object): any
  emitEvent(event: string, options?: { context?: object }): Promise<any>
}

// The form, list, object or tree that owns the resource:
export interface ResourceOwner {
  readonly verbs: Record<string, string>
  readonly dataModel: DataModel
  getResource(options?: ResourceOptions): Resource | null
  submit(button: SubmitButton, options?: SubmitOptions): Promise<boolean>
}

// Forms and sources provide it also without a resource of their own:
export class ResourceContext {
  readonly #owner: ResourceOwner
  readonly #route: RouteContext | null

  constructor(
    owner: ResourceOwner,
    // The route that renders the owner, or the parent route of forms:
    { route }: { route: RouteContext | null }
  ) {
    this.#owner = owner
    this.#route = route
  }

  // The context of the form that renders the owner, or of the parent form:
  get parent(): ResourceContext | null {
    return this.#route?.resource ?? null
  }

  // The closest context with a resource, which loads the displayed data:
  get resourceOwner(): ResourceContext | null {
    return this.getResource()
      ? this
      : (this.parent?.resourceOwner ?? null)
  }

  get verbs(): Record<string, string> {
    return this.#owner.verbs
  }

  getResource(options?: ResourceOptions): Resource | null {
    return this.#owner.getResource(options)
  }

  // Leaving the route waits for pending submits:
  submit(button: SubmitButton, options?: SubmitOptions): Promise<boolean> {
    return this.#owner.dataModel.trackPendingSubmit(
      this.#owner.submit(button, options)
    )
  }
}
