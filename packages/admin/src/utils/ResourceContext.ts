import type { DataModel } from './DataModel.js'
import type { RouteContext } from './RouteContext.ts'

type Resource = Record<string, any>

export interface ResourceOptions {
  method?: string
  child?: Resource | null
}

// The form, list, object or tree that submits its data and resolves the
// resources of its components.
export interface ResourceOwner {
  readonly verbs: Record<string, string>
  readonly dataModel: DataModel
  getResource(options?: ResourceOptions): Resource | null
  submit(button: unknown, options?: Record<string, any>): Promise<boolean>
}

// The context of a form or source, provided to the components that it
// renders, also when it has no resource of its own, e.g. in nested data.
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

  // The context that the resource of the owner continues: the one of the form
  // that renders the owner, or of the parent form of forms, `null` in views.
  get parent(): ResourceContext | null {
    return this.#route?.resource ?? null
  }

  // The context itself if it has a resource, or else the closest one above
  // with a resource, which loads the data that its components display:
  get closestWithResource(): ResourceContext | null {
    return this.getResource()
      ? this
      : (this.parent?.closestWithResource ?? null)
  }

  get verbs(): Record<string, string> {
    return this.#owner.verbs
  }

  getResource(options?: ResourceOptions): Resource | null {
    return this.#owner.getResource(options)
  }

  // Submit the data through `button`, which waiting to leave the route
  // respects, and resolve with whether it succeeded:
  submit(button: unknown, options?: Record<string, any>): Promise<boolean> {
    return this.#owner.dataModel.trackPendingSubmit(
      this.#owner.submit(button, options)
    )
  }
}
