import type { z } from 'zod'
import { asArray, isFunction } from '@ditojs/utils'
import type {
  ActionDefinition,
  ActionSettings,
  Actions,
  Authorize,
  ControllerDefinition,
  HandlerInput,
  Middleware,
  MixinDefinition,
  Verb
} from './types.ts'

// Resolves a controller into its routes, once in `createApi()`. Its layers are
// its mixins and the controller, in the order of `getLayers()`. In `actions`, a
// function replaces the handler beneath it and runs it as `next()`, and `true`
// routes the handler beneath. A setting comes from the last action definition
// that has it, else from the last layer that has it. A mixin with actions only
// counts as a layer for its own actions, so its settings stay on them.

// Runs the handlers of an action, on the input without `next`.
type ActionRun = (input: Omit<HandlerInput, 'next'>) => Promise<unknown>

export interface ResolvedAction {
  // The key in `actions`, such as `post :id/publish`, and its verb and path.
  key: string
  verb: Verb
  // '' for a key without a path.
  path: string
  query: z.ZodType | undefined
  body: z.ZodType | undefined
  authorize: Authorize | undefined
  transacted: boolean | undefined
  middleware: Middleware[]
  run: ActionRun
}

const verbs: Verb[] = ['get', 'post', 'put', 'patch', 'delete']

export function resolveController(controller: ControllerDefinition) {
  const { path } = controller
  if (!isValidPath(path)) {
    throw new Error(`Invalid path '${path}'`)
  }
  if (path.split('/').includes(':id')) {
    throw new Error(`The path '${path}' holds \`:id\``)
  }
  return { path, actions: resolveActions(path, getLayers(controller)) }
}

// The layers of a definition: its mixins depth-first, then the definition
// itself. A mixin listed twice is one layer, where it is first listed.
export function getLayers(def: MixinDefinition) {
  const layers = new Set<MixinDefinition>()
  const add = (def: MixinDefinition) => {
    if (layers.has(def)) return
    for (const mixin of def.mixins ?? []) add(mixin)
    layers.add(def)
  }
  add(def)
  return [...layers]
}

function resolveActions(controllerPath: string, layers: MixinDefinition[]) {
  const where = `'${controllerPath}'`
  const entries = new Map<string, ActionDefinition[]>()
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer.actions ?? {})) {
      if (value === undefined) continue
      let defs = entries.get(key)
      if (!defs) entries.set(key, (defs = []))
      if (value !== true) {
        defs.push((isFunction(value) ? { handler: value } : value) as never)
      }
    }
  }

  const actions: ResolvedAction[] = []
  for (const [key, defs] of entries) {
    const [verb, path = '', ...rest] = key.split(' ') as [Verb, string?]
    if (
      !verbs.includes(verb) ||
      rest.length ||
      (key.includes(' ') && !isValidPath(path))
    ) {
      throw new Error(`Invalid action '${key}' in ${where}`)
    }
    const handlers = defs.flatMap(def => def.handler ?? [])
    if (!handlers.length) {
      throw new Error(`'${key}' has no handler in ${where}`)
    }
    const owners = layers.filter(
      layer => (
        layer === layers.at(-1) ||
        !layer.actions ||
        layer.actions[key as keyof Actions] !== undefined
      )
    )
    const setting = <K extends keyof ActionSettings>(name: K) => (
      findLast(defs.map(def => def[name])) ??
      findLast(owners.map(layer => layer[name]))
    )
    const authorize = setting('authorize')
    if (verb !== 'get' && authorize === undefined) {
      throw new Error(`'${key}' has no \`authorize\` in ${where}`)
    }
    actions.push({
      key,
      verb,
      path,
      query: findLast(defs.map(def => def.query)),
      body: findLast(defs.map(def => def.body)),
      authorize,
      transacted: setting('transacted'),
      middleware: [
        ...layers.flatMap(layer => asArray(layer.middleware)),
        ...defs.flatMap(def => asArray(def.middleware))
      ],
      run: handlers.reduce<ActionRun>(
        (beneath, handler) => async input => {
          // Each handler has its own `next`. The layer beneath starts from
          // this input, so that a handler can change `input.body` for it.
          const own: HandlerInput = { ...input, next: () => beneath(own) }
          return handler(own as never)
        },
        async () => undefined
      )
    })
  }
  return actions
}

// The rank of each segment, by how much it matches: 0 for static ones, 1 for
// parameters with a pattern, 2 for plain parameters, and 3 for wildcards and
// patterns that match any text, such as `:path{.+}`.
export function rank(path: string) {
  return path.split('/').map(segment => {
    if (segment === '*' || /^:.*\{\.[+*]\}$/.test(segment)) return 3
    if (segment[0] !== ':') return 0
    return segment.includes('{') ? 1 : 2
  })
}

export function compareRanks(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!
  }
  return 0
}

// Paths have no empty segments, so no leading, trailing or double slashes.
function isValidPath(path: string) {
  return path.split('/').every(segment => segment !== '')
}

function findLast<T>(values: (T | undefined)[]) {
  return values.findLast(value => value !== undefined)
}
