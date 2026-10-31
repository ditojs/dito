import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  ActionDefinition,
  ControllerDefinition,
  FeatureDefinition,
  TypedActions
} from './types.ts'

// The bases that `withBase()` puts under controllers, by controller.
const bases = new WeakMap<ControllerDefinition, FeatureDefinition>()

// A definition whose handlers get the params of their action keys.
export type Typed<D extends FeatureDefinition, C, M> = Omit<
  D,
  'collection' | 'member'
> & {
  collection?: TypedActions<C, 'collection'>
  member?: TypedActions<M, 'member'>
}

export function defineController<C = {}, M = {}>(
  def: Typed<ControllerDefinition, C, M>
) {
  return def as ControllerDefinition
}

export function defineFeature<C = {}, M = {}>(
  def: Typed<FeatureDefinition, C, M>
) {
  return def as FeatureDefinition
}

// Infers the types of `ctx.query` and `ctx.body` in the handler from the
// `query` and `body` schemas. Its handler's `ctx.params` are untyped. The
// result doesn't infer the schemas from the type that it is assigned to.
export function action<
  Q extends StandardSchemaV1 | undefined = undefined,
  B extends StandardSchemaV1 | undefined = undefined
>(def: ActionDefinition<Q, B>): ActionDefinition<NoInfer<Q>, NoInfer<B>> {
  return def
}

// Puts `base` under the controller as its first layer, beneath its features
// and its own definition. ORM packages use it for their default verbs and
// slots. The default verbs are routed only if `allow` lists them.
export function withBase(
  base: FeatureDefinition,
  def: ControllerDefinition
): ControllerDefinition {
  const controller = { ...def }
  bases.set(controller, base)
  return controller
}

export function getBase(controller: ControllerDefinition) {
  return bases.get(controller)
}
