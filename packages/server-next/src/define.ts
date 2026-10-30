import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  ActionDefinition,
  ControllerDefinition,
  FeatureDefinition
} from './types.ts'

// The bases that `withBase()` puts under controllers, by controller.
const bases = new WeakMap<ControllerDefinition, FeatureDefinition>()

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
  def: ControllerDefinition
): ControllerDefinition {
  const controller = { ...def }
  bases.set(controller, base)
  return controller
}

export function getBase(controller: ControllerDefinition) {
  return bases.get(controller)
}
