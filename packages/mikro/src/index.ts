// Model controllers on MikroORM entities, and the parts an app needs to run
// them. The app wires these into its own Hono app:
//
//   const app = new Hono()
//   const api = createApp({
//     controllers,
//     transaction: mikroTransaction(orm),
//     getUser
//   })
//   app.use(requestContext(orm))
//   app.onError((error, c) => {
//     log(error)
//     return problemResponse(toProblem(error) ?? error, c)
//   })
//   app.notFound(c => problemResponse(new ProblemError({ status: 404 }), c))
//   app.route('/', api)

export {
  defineController,
  type MikroControllerDefinition
} from './controller.ts'
export type { Filter, FindShape } from './list.ts'
export {
  buildWriteSchemas,
  type WriteRules,
  type WriteSchemas
} from './write-schema.ts'
export {
  getEntityManager,
  mikroTransaction,
  requestContext
} from './transaction.ts'
export { createValidationError, toProblem, type FieldError } from './errors.ts'
