// Model controllers on Dito 6's Objection models, and the parts an app needs
// to run them:
//
//   const api = createApp({
//     controllers: withRelations(controllers),
//     around: requestStorage(dito),
//     transaction: objectionTransaction(dito),
//     connect: objectionConnect(dito),
//     getUser,
//     onError: (error, ctx) => {
//       log(error)
//       return errorResponse(toHttpError(error) ?? error)
//     }
//   })

export {
  defineController,
  withRelations,
  type ModelControllerDefinition
} from './controller.ts'
export { type RelationControllerDefinition } from './relation.ts'
export {
  objectionConnect,
  objectionTransaction,
  requestStorage
} from './transaction.ts'
export { toHttpError } from './errors.ts'
export { objectionKysely } from './kysely.ts'
