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

// Forms and sources with a resource provide it to their components, forms also
// their parent's, as the resource of the route:
export interface ResourceContext {
  getResource(options?: ResourceOptions): Resource | null
}
