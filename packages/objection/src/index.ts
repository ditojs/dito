// Model controllers on Dito 6's Objection models, and the parts an app needs
// to run them. The app wires these into its own Hono app:
//
//   const app = new Hono()
//   const api = createApp({
//     controllers,
//     transaction: objectionTransaction(dito),
//     getUser
//   })
//   app.use(requestStorage(dito))
//   app.onError((error, c) => {
//     log(error)
//     return problemResponse(toProblem(error) ?? error, c)
//   })
//   app.notFound(c => problemResponse(new ProblemError({ status: 404 }), c))
//   app.route('/', api)

export {
  defineController,
  type ModelControllerDefinition
} from './controller.ts'
export { objectionTransaction, requestStorage } from './transaction.ts'
export { toProblem } from './errors.ts'
