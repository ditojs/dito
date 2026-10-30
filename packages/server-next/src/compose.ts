import type { MiddlewareHandler } from 'hono'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { asArray, isFunction } from '@ditojs/utils'
import { getBase, type BaseOptions } from './define.ts'
import type {
  ActionDefinition,
  ActionInfo,
  Actions,
  Authorize,
  ControllerDefinition,
  DitoContext,
  DitoEnv,
  FeatureDefinition,
  Slots,
  Verb
} from './types.ts'

// Resolves a controller into its routes, once at app creation. Its layers are
// the base of `withBase()`, the features of `use` (depth-first, in order), and
// the controller's own definition. A later layer wins over an earlier one, and
// its action of the same key wraps the earlier one, which it runs as `next()`.
// The last layer's `allow` picks the default verbs of the base to route.

type Kind = 'base' | 'feature' | 'controller'

interface Layer {
  def: FeatureDefinition
  kind: Kind
}

export interface ResolvedAction {
  info: ActionInfo
  // The path under the controller, such as `/:id{[0-9]+}/publish`.
  route: string
  authorize: Authorize | undefined
  transacted: boolean | undefined
  query: StandardSchemaV1 | undefined
  body: StandardSchemaV1 | undefined
  around: MiddlewareHandler<DitoEnv>[]
  run: (c: DitoContext) => Promise<unknown>
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
  const mode = getBase(controller)?.allow ?? 'all'
  return {
    path: controller.path,
    // Collection routes go first, so that `/:id` never shadows their paths.
    actions: [
      ...resolveActions(controller, layers, 'collection', mode),
      ...resolveActions(controller, layers, 'member', mode)
    ],
    slots: {
      load: last('load'),
      finish: last('finish'),
      toJSON: last('toJSON'),
      isRow: last('isRow'),
      owner: last('owner')
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
    for (const feature of def.use ?? []) add(feature, kind)
    layers.push({ def, kind })
  }
  const base = getBase(controller)
  if (base) add(base.def, 'base')
  for (const feature of controller.use ?? []) add(feature, 'feature')
  layers.push({ def: controller, kind: 'controller' })
  return layers
}

function resolveActions(
  controller: ControllerDefinition,
  layers: Layer[],
  on: 'collection' | 'member',
  mode: NonNullable<BaseOptions['allow']>
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
    // `allow` picks the base's default verbs to route, and `*` allows them
    // all. Without `allow`, the base's `allow` option decides. A verb that a
    // feature or the controller defines is always routed, as in Dito 6.
    const isAllowed = allow
      ? allowsAll || allow.includes(verb)
      : mode === 'all'
    const isBase = list.every(entry => entry.kind === 'base')
    if (isDefault && isBase && !isAllowed) continue
    const defs = list.map(entry => entry.def)
    const fromAction = <K extends keyof ActionDefinition>(key: K) =>
      findLast(defs.map(def => def[key]))
    const fromLayers = <K extends 'authorize' | 'transacted'>(key: K) => (
      fromAction(key) ?? findLast(layers.map(layer => layer.def[key]))
    )
    const route =
      on === 'member'
        ? `/:id{[0-9]+}${path ? `/${path}` : ''}`
        : `/${path ?? ''}`
    actions.push({
      info: { controller: controller.path, on, name: key, verb },
      route,
      authorize: fromLayers('authorize'),
      transacted: fromLayers('transacted'),
      query: fromAction('query'),
      body: fromAction('body'),
      around: [
        ...layers.flatMap(layer => asArray(layer.def.around)),
        ...defs.flatMap(def => asArray(def.around))
      ],
      run: c =>
        defs.reduce<() => Promise<unknown>>(
          (next, def) => async () => def.handler(c, next),
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
