import type { StandardSchemaV1 } from '@standard-schema/spec'
import { asArray, isFunction } from '@ditojs/utils'
import { getBase } from './define.ts'
import type {
  ActionDefinition,
  ActionInfo,
  Actions,
  Authorize,
  ControllerDefinition,
  DitoContext,
  FeatureDefinition,
  Middleware,
  Slots,
  Verb
} from './types.ts'

// Resolves a controller into its routes, once at app creation. Its layers are
// the base of `withBase()`, the `features` (depth-first, in order), and the
// controller's own definition. A later layer wins over an earlier one, and its
// action of the same key wraps the earlier one, which it runs as `next()`.
// The default verbs of the base are routed only if the last layer's `allow`
// lists them. A verb that a feature or the controller defines is always
// routed.

type Kind = 'base' | 'feature' | 'controller'

interface Layer {
  def: FeatureDefinition
  kind: Kind
}

export interface ResolvedAction {
  info: ActionInfo
  // The path under the controller, such as `/:id/publish`.
  route: string
  authorize: Authorize | undefined
  transaction: boolean | undefined
  query: StandardSchemaV1 | undefined
  body: StandardSchemaV1 | undefined
  middleware: Middleware[]
  run: (ctx: DitoContext) => Promise<unknown>
  // A default collection `post`, which answers 201.
  isCreate: boolean
}

export interface ResolvedController {
  path: string
  actions: ResolvedAction[]
  slots: Slots
  serialize: NonNullable<FeatureDefinition['serialize']>[]
}

const verbs: Verb[] = ['get', 'post', 'put', 'patch', 'delete']

export function resolveController(
  controller: ControllerDefinition
): ResolvedController {
  const layers = getLayers(controller)
  const last = <K extends keyof FeatureDefinition>(key: K) =>
    findLast(layers.map(layer => layer.def[key]))
  return {
    path: controller.path,
    // Collection routes go first, so that `/:id` never shadows their paths.
    actions: [
      ...resolveActions(controller, layers, 'collection'),
      ...resolveActions(controller, layers, 'member')
    ],
    slots: {
      load: last('load'),
      onResult: last('onResult'),
      isRecord: last('isRecord')
    },
    serialize: layers.flatMap(layer => layer.def.serialize ?? [])
  }
}

function getLayers(controller: ControllerDefinition) {
  const layers: Layer[] = []
  const seen = new Set<FeatureDefinition>()
  const add = (def: FeatureDefinition, kind: Kind) => {
    // A feature that several features use is one layer.
    if (seen.has(def)) return
    seen.add(def)
    for (const feature of def.features ?? []) add(feature, kind)
    layers.push({ def, kind })
  }
  const base = getBase(controller)
  if (base) add(base, 'base')
  for (const feature of controller.features ?? []) add(feature, 'feature')
  layers.push({ def: controller, kind: 'controller' })
  return layers
}

function resolveActions(
  controller: ControllerDefinition,
  layers: Layer[],
  on: 'collection' | 'member'
) {
  const where = `${on} of '${controller.path}'`
  const allow = findLast(layers.map(layer => layer.def[on]?.allow))
  const definitions = new Map<string, { kind: Kind; def: ActionDefinition }[]>()
  for (const { def, kind } of layers) {
    for (const [key, value] of Object.entries(def[on] ?? {}) as [
      keyof Actions,
      unknown
    ][]) {
      if (key === 'allow' || value === undefined) continue
      const list = definitions.get(key) ?? []
      if (kind === 'feature' && list.some(entry => entry.kind === 'feature')) {
        throw new Error(`'${key}' is defined by two features in the ${where}`)
      }
      list.push({
        kind,
        def: (
          isFunction(value)
            ? { handler: value }
            : value
        ) as ActionDefinition
      })
      definitions.set(key, list)
    }
  }

  const allowsAll = !!allow?.includes('*')
  for (const verb of allow ?? []) {
    if (verb !== '*' && !definitions.has(verb)) {
      throw new Error(
        `'${verb}' is in \`allow\` but not defined in the ${where}`
      )
    }
  }

  const actions: ResolvedAction[] = []
  for (const [key, list] of definitions) {
    const [verb, path, ...rest] = key.split(' ') as [Verb, string?]
    if (!verbs.includes(verb) || path === '' || rest.length) {
      throw new Error(`Invalid action '${key}' in the ${where}`)
    }
    const isDefault = !path
    const isAllowed = allowsAll || !!allow?.includes(verb)
    const isBase = list.every(entry => entry.kind === 'base')
    if (isDefault && isBase && !isAllowed) continue
    const defs = list.map(entry => entry.def)
    const fromAction = <K extends keyof ActionDefinition>(key: K) =>
      findLast(defs.map(def => def[key]))
    const fromLayers = <K extends 'authorize' | 'transaction'>(key: K) => (
      fromAction(key) ?? findLast(layers.map(layer => layer.def[key]))
    )
    const route =
      on === 'member'
        ? `/:id${path ? `/${path}` : ''}`
        : `/${path ?? ''}`
    actions.push({
      info: {
        controller: controller.path,
        on,
        name: key,
        verb,
        query: fromAction('query'),
        body: fromAction('body')
      },
      route,
      authorize: fromLayers('authorize'),
      transaction: fromLayers('transaction'),
      query: fromAction('query'),
      body: fromAction('body'),
      middleware: [
        ...layers.flatMap(layer => asArray(layer.def.middleware)),
        ...defs.flatMap(def => asArray(def.middleware))
      ],
      run: ctx =>
        defs.reduce<() => Promise<unknown>>(
          (next, def) => async () => def.handler(ctx as never, next),
          async () => undefined
        )(),
      isCreate: isDefault && on === 'collection' && verb === 'post'
    })
  }
  return actions
}

function findLast<T>(values: (T | undefined)[]) {
  return values.findLast(value => value !== undefined)
}
