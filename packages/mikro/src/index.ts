// Model controllers on MikroORM entities, and the parts an app needs to run
// them:
//
//   const api = createApi({ controllers, db: mikroDb(orm), getUser })
//   app.route('/api', api)

export {
  defineController,
  type MikroControllerDefinition
} from './controller.ts'
export { choices, crud, listHandler } from './crud.ts'
export { setRecord } from './model-request.ts'
export { assignRecord, createRecord, removeRecord } from './write.ts'
export type { Find, FindShape } from './find.ts'
export { dateRangeFilter, textFilter } from './filters.ts'
export type { Filter } from './list.ts'
export { parseListQuery, type ListQuery } from './list-query.ts'
export { PlainDate, plainDate } from './plain-date.ts'
export { SchemaJson, schemaJson } from './schema-json.ts'
export { getEntityManager, getKysely, mikroDb } from './transaction.ts'
export {
  entityUserSource,
  type EntityUserSourceOptions
} from './user-source.ts'
