import type { z } from 'zod'
import { asArray, isFunction } from '@ditojs/utils'
import type {
  ActionSettings,
  Actions,
  Authorize,
  ControllerDefinition,
  Handler,
  HandlerContext,
  Middleware,
  MixinDefinition,
  Verb
} from './types.ts'

// The object form of an action, into which a handler function is wrapped.
type ActionObject = Exclude<
  Actions[keyof Actions],
  true | Handler | undefined
>

// The handlers of an action, which take the context without `next`.
type ActionRun = (context: Omit<HandlerContext, 'next'>) => Promise<unknown>

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
    throw new Error(`Invalid path: '${path}'.`)
  }
  if (path.split('/').includes(':id')) {
    throw new Error(
      `Invalid path: '${path}'. \`:id\` belongs to the record actions.`
    )
  }
  return resolveActions(path, getLayers(controller))
}

// Collect the mixins depth-first, then the definition itself. A mixin listed
// twice is one layer, where it is first listed.
export function getLayers(definition: MixinDefinition) {
  const layers = new Set<MixinDefinition>()
  const add = (layer: MixinDefinition) => {
    if (!layers.has(layer)) {
      for (const mixin of layer.mixins ?? []) add(mixin)
      layers.add(layer)
    }
  }
  add(definition)
  return [...layers]
}

function resolveActions(controllerPath: string, layers: MixinDefinition[]) {
  const where = `'${controllerPath}'`
  const definitionsByKey = new Map<string, ActionObject[]>()
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer.actions ?? {})) {
      if (value !== undefined) {
        const definitions = definitionsByKey.get(key) ?? []
        definitionsByKey.set(key, definitions)
        if (value !== true) {
          definitions.push(isFunction(value) ? { handler: value } : value)
        }
      }
    }
  }

  const actions: ResolvedAction[] = []
  for (const [key, definitions] of definitionsByKey) {
    const [method, path = '', ...rest] = key.split(' ')
    const verb = verbs.find(verb => verb === method)
    if (!verb || rest.length || (key.includes(' ') && !isValidPath(path))) {
      throw new Error(`Invalid action: '${key}' in ${where}.`)
    }
    const handlers = definitions.flatMap(definition => definition.handler ?? [])
    if (!handlers.length) {
      throw new Error(`Invalid action without a handler: '${key}' in ${where}.`)
    }
    // A mixin with actions only counts as a layer for its own actions, so its
    // settings stay on them.
    const owners = layers.filter(
      layer => (
        layer === layers.at(-1) ||
        !layer.actions ||
        layer.actions[key as keyof Actions] !== undefined
      )
    )
    // Take a setting from the last action definition that has it, else from
    // the last layer:
    const getSetting = <K extends keyof ActionSettings>(name: K) => (
      findLast(definitions.map(definition => definition[name])) ??
      findLast(owners.map(layer => layer[name]))
    )
    const authorize = getSetting('authorize')
    if (verb !== 'get' && authorize === undefined) {
      throw new Error(
        `Invalid action without \`authorize\`: '${key}' in ${where}.`
      )
    }
    actions.push({
      key,
      verb,
      path,
      query: findLast(definitions.map(definition => definition.query)),
      body: findLast(definitions.map(definition => definition.body)),
      authorize,
      transacted: getSetting('transacted'),
      middleware: [
        ...layers.flatMap(layer => asArray(layer.middleware)),
        ...definitions.flatMap(definition => asArray(definition.middleware))
      ],
      run: handlers.reduce<ActionRun>(
        (beneath, handler) => async context => {
          // Each handler has its own `next`. The layer beneath starts from
          // this context, so that a handler can change `context.body` for it.
          const layerContext: HandlerContext = {
            ...context,
            next: () => beneath(layerContext)
          }
          return handler(layerContext)
        },
        async () => undefined
      )
    })
  }
  return actions
}

// Paths have no empty segments, so no leading, trailing or double slashes.
function isValidPath(path: string) {
  return path.split('/').every(segment => segment !== '')
}

function findLast<T>(values: (T | undefined)[]) {
  return values.findLast(value => value !== undefined)
}
