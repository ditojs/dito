import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  ActionDefinition,
  ControllerDefinition,
  FeatureDefinition
} from './types.ts'

// The bases that `withBase()` puts under controllers, by controller.
const bases = new WeakMap<ControllerDefinition, Base>()

export interface BaseOptions {
  // Which default verbs of the base to route without `allow`: `all` of them,
  // or only the `defined` ones, which a feature or the controller defines
  // too. Dito 6 routes the defined ones.
  allow?: 'all' | 'defined'
}

interface Base extends Required<BaseOptions> {
  def: FeatureDefinition
}

export function defineController(def: ControllerDefinition) {
  return def
}

export function defineFeature(def: FeatureDefinition) {
  return def
}

// Infers the types of `c.req.valid('query')` and `c.req.valid('json')` in the
// handler from the `query` and `body` schemas.
export function action<
  Q extends StandardSchemaV1 | undefined = undefined,
  B extends StandardSchemaV1 | undefined = undefined
>(def: ActionDefinition<Q, B>) {
  return def
}

// Puts `base` under the controller as its first layer, beneath its features
// and its own definition. ORM packages use it for their default handlers and
// slots.
export function withBase(
  base: FeatureDefinition,
  def: ControllerDefinition,
  { allow = 'all' }: BaseOptions = {}
): ControllerDefinition {
  const controller = { ...def }
  bases.set(controller, { def: base, allow })
  return controller
}

export function getBase(controller: ControllerDefinition) {
  return bases.get(controller)
}
