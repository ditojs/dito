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
  getResource(options?: ResourceOptions): Resource | null
  submit(button: SubmitButton, options?: SubmitOptions): Promise<boolean>
}

// Only forms and sources with a resource provide it, so components see the
// nearest one with a resource:
export class ResourceContext {
  readonly #owner: ResourceOwner

  constructor(owner: ResourceOwner) {
    this.#owner = owner
  }

  getResource(options?: ResourceOptions): Resource | null {
    return this.#owner.getResource(options)
  }

  submit(button: SubmitButton, options?: SubmitOptions): Promise<boolean> {
    return this.#owner.submit(button, options)
  }
}
