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
export { setRecord } from './ModelRequest.ts'
export { assignRecord, createRecord } from './write.ts'
export type { Find, FindShape } from './find.ts'
export {
  defineDateRangeFilter,
  defineFilter,
  defineTextFilter,
  type Filter
} from './filters.ts'
export type { ListQuery } from './listQuery.ts'
export { defineMikroConfig } from './defineMikroConfig.ts'
export {
  defineJsonType,
  getAssetPaths,
  type JsonTypeAsset,
  type JsonTypeOptions
} from './SchemaJsonType.ts'
export { createMikroAdapter } from './createMikroAdapter.ts'
export {
  createEntityUserSource,
  type EntityUserSourceOptions
} from './createEntityUserSource.ts'
