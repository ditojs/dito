import type { z } from 'zod'
import { isObject } from '@ditojs/utils'
import type {
  ActionDefinition,
  ControllerDefinition,
  MixinDefinition
} from './types.ts'

// Mark the results of `defineController()`, so that `createApi()` can pick
// them from the exports of a module.
const controllerTag = Symbol.for('@ditojs/server/controller')

// Tag the controller, and type it where it is written.
export function defineController(
  definition: ControllerDefinition
): ControllerDefinition {
  return { ...definition, [controllerTag]: true } as ControllerDefinition
}

export function isController(value: unknown): value is ControllerDefinition {
  return isObject(value) && controllerTag in value
}

// Only give the mixin its types.
export function defineMixin(definition: MixinDefinition) {
  return definition
}

// Infer the types of `query` and `body` of the handler's context, and of
// `c.req.valid()`, from the schemas. `NoInfer` keeps the type that the result
// is assigned to from changing the schemas.
export function defineAction<
  Q extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined
>(
  definition: ActionDefinition<Q, B>
): ActionDefinition<NoInfer<Q>, NoInfer<B>> {
  return definition
}
