import type { z } from 'zod'
import type {
  ActionDefinition,
  ControllerDefinition,
  MixinDefinition
} from './types.ts'

// Only give the controller its types.
export function defineController(definition: ControllerDefinition) {
  return definition
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
