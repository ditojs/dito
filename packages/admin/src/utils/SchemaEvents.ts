import { isFunction } from '@ditojs/utils'
import { getSchemaEventEntries } from './schema/events.js'
import type { Context } from './schema/types.ts'
import type { Schema } from './types.ts'

type Callback = (context: Context) => any

// `input` and `change` events bubble to the schemas above, unless handlers
// return `false`:
export class SchemaEvents {
  readonly dataPath: string
  readonly parent: SchemaEvents | null
  readonly #callbacks: Record<string, Callback> = {}

  constructor(
    schema: Schema,
    dataPath: string,
    parent: SchemaEvents | null = null
  ) {
    this.dataPath = dataPath
    this.parent = parent
    for (const { key, event, callback } of getSchemaEventEntries(schema)) {
      if (isFunction(callback)) {
        this.#callbacks[event] = callback
      } else {
        console.error(`Invalid event definition: ${key}: ${callback}`)
      }
    }
  }

  has(event: string, { bubble = isBubbling(event) } = {}): boolean {
    return (
      !!this.#callbacks[event] ||
      bubble && !!this.parent?.has(event, { bubble })
    )
  }

  // Await the handler and resolve with its result, or reject with its error.
  // Separate emits don't wait for each other, so a handler can await an emit of
  // its own event:
  async emit(
    event: string,
    context: Context,
    { bubble = isBubbling(event) } = {}
  ): Promise<any> {
    const callback = this.#callbacks[event]
    // Handlers of bubbled events also need the data path of their own schema.
    // Without a handler, bubble right away, while the values are current:
    const result = callback
      ? await callback(context.extend({ currentDataPath: this.dataPath }))
      : undefined
    if (bubble && result !== false && this.parent?.has(event, { bubble })) {
      await this.parent.emit(event, context, { bubble })
    }
    return result
  }
}

function isBubbling(event: string) {
  return event === 'input' || event === 'change'
}
