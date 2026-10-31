// Model controllers on MikroORM entities, and the parts an app needs to run
// them:
//
//   const api = createApp({
//     controllers,
//     transaction: mikroTransaction(orm),
//     connect: mikroConnect(orm),
//     getUser,
//     onError(error) {
//       log(error)
//       return errorResponse(toHttpError(error) ?? error)
//     }
//   })

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
  mikroConnect,
  mikroTransaction,
  requestContext
} from './transaction.ts'
export {
  createValidationError,
  toHttpError,
  type FieldError
} from './errors.ts'
