// Model controllers on MikroORM entities, and the parts an app needs to run
// them:
//
//   const adapter = createMikroAdapter(orm)
//   const api = createApi({ controllers, adapter, getUser })
//   app.route('/api', api)

export {
  defineModelController,
  type ModelControllerDefinition
} from './controller.ts'
export { crud, defineChoices, defineListHandler } from './crud.ts'
export { setRecord } from './model-request.ts'
export { assignRecord, createRecord } from './write.ts'
export type { Find, FindShape } from './find.ts'
export {
  defineDateRangeFilter,
  defineFilter,
  defineTextFilter
} from './filters.ts'
export type { Filter } from './list.ts'
export type { ListQuery } from './list-query.ts'
export { defineMikroConfig, getAssetPaths } from './config.ts'
export {
  defineJsonType,
  type JsonTypeAsset,
  type JsonTypeOptions
} from './schema-json.ts'
export {
  createMikroAdapter,
  getEntityManager,
  getKysely
} from './transaction.ts'
export {
  createEntityUserSource,
  type EntityUserSourceOptions
} from './user-source.ts'
