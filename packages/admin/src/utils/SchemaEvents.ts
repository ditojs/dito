import { isFunction } from '@ditojs/utils'
import { getSchemaEventEntries } from './schema/events.js'
import type { Context } from './schema/types.ts'
import type { Schema } from './types.ts'

type Callback = (context: Context) => any

// `change` events bubble to the schemas above, unless handlers return `false`:
export class SchemaEvents {
  readonly parent: SchemaEvents | null
  readonly #callbacks: Record<string, Callback[]> = {}

  constructor(schema: Schema, parent: SchemaEvents | null = null) {
    this.parent = parent
    for (const { key, event, callback } of getSchemaEventEntries(schema)) {
      if (isFunction(callback)) {
        const callbacks = (this.#callbacks[event] ??= [])
        callbacks.push(callback)
      } else {
        console.error(`Invalid event definition: ${key}: ${callback}`)
      }
    }
  }

  has(event: string, { bubble = event === 'change' } = {}): boolean {
    return !!this.#callbacks[event] || (bubble && !!this.parent?.has(event))
  }

  // Await the handlers one after the other, and resolve with the last result
  // that isn't undefined. Separate emits don't wait for each other, so a
  // handler can await an emit of its own event:
  async emit(
    event: string,
    context: Context,
    { bubble = event === 'change' } = {}
  ): Promise<any> {
    let result
    const errors = []
    for (const callback of this.#callbacks[event] ?? []) {
      try {
        const callbackResult = await callback(context)
        if (callbackResult !== undefined) {
          result = callbackResult
        }
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Errors during event handler for '${event}'`
      )
    }
    if (bubble && result !== false && this.parent?.has(event)) {
      await this.parent.emit(event, context)
    }
    return result
  }
}
