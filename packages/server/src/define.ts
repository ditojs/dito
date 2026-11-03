import type { StandardSchemaV1 } from '@standard-schema/spec'
import { isObject } from '@ditojs/utils'
import type {
  ActionDefinition,
  ControllerDefinition,
  MixinDefinition
} from './types.ts'

// Marks the results of `defineController()`, so that `createApi()` can pick
// them from the exports of a module.
const controllerTag = Symbol.for('@ditojs/server/controller')

// Tags a controller and types it where it is written.
export function defineController(
  def: ControllerDefinition
): ControllerDefinition {
  return { ...def, [controllerTag]: true } as ControllerDefinition
}

export function isController(value: unknown): value is ControllerDefinition {
  return isObject(value) && controllerTag in value
}

// Types a mixin where it is written.
export function defineMixin(def: MixinDefinition) {
  return def
}

// Infers the types of `query` and `body` of the handler's input, and of
// `c.req.valid()`, from the schemas. `NoInfer` keeps the type that the result
// is assigned to from changing the schemas.
export function action<
  Q extends StandardSchemaV1 | undefined = undefined,
  B extends StandardSchemaV1 | undefined = undefined
>(def: ActionDefinition<Q, B>): ActionDefinition<NoInfer<Q>, NoInfer<B>> {
  return def
}
