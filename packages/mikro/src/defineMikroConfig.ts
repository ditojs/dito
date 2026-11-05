import {
  DateType,
  EntitySchema,
  ReferenceKind,
  type EntityManager,
  type MetadataStorage,
  type Options
} from '@mikro-orm/core'
import { getEntities } from './meta.ts'
import { PlainDate } from './plain-date.ts'
import { RemovedRows, SchemaDefaults } from './subscribers.ts'

// The options of `new MikroORM()` for entities of Dito: `p.date()` columns keep
// the local day, new rows get the defaults of their `defineJsonType()` schemas,
// and `em.remove()` deletes owned rows and follows the delete rules of foreign
// keys. Pivot entities with an id of their own log a warning. `entities` can be
// a module of them, like in `getAssetPaths()`.
//
//   const orm = new MikroORM(defineMikroConfig({ dbName, entities }))
export function defineMikroConfig<T extends Partial<Options<any, any, any>>>(
  options: Omit<T, 'entities'> & { entities?: T['entities'] | object }
): T {
  const {
    discovery,
    subscribers = [],
    entities
  } = options as Partial<Options<any, any, any>>
  const result: Partial<Options<any, any, any>> = {
    ...options,
    ...(entities && { entities: getEntities(entities) }),
    subscribers: [...subscribers, new SchemaDefaults(), new RemovedRows()],
    discovery: {
      ...discovery,
      onMetadata(meta, platform) {
        for (const prop of Object.values(meta.properties)) {
          if ((prop.type as unknown) === DateType) {
            prop.type = PlainDate as never
          }
        }
        return discovery?.onMetadata?.(meta, platform)
      },
      afterDiscovered(storage, platform) {
        warnOfPivotIds(storage)
        return discovery?.afterDiscovered?.(storage, platform)
      }
    }
  }
  return result as T
}

// Whether `defineMikroConfig()` created the entity manager's ORM.
export const hasMikroConfig = (em: EntityManager) =>
  [...em.getEventManager().getSubscribers()].some(
    subscriber => subscriber instanceof RemovedRows
  )

// With an id of its own, a pivot table is ordered by it, its kept pairs lose
// their other columns on writes, and upserts write pairs twice.
function warnOfPivotIds(storage: MetadataStorage) {
  for (const meta of storage.getAll().values()) {
    for (const prop of meta.relations) {
      if (prop.kind !== ReferenceKind.MANY_TO_MANY || !prop.owner) continue
      const pivot = storage.get(prop.pivotEntity)
      // The id of a generated pivot is the choice of `fixedOrder`.
      const isDefined = EntitySchema.REGISTRY.has(pivot.class)
      if (isDefined && pivot.primaryKeys.length < 2) {
        console.warn(
          `The pivot of ${meta.className}.${prop.name} needs a composite ` +
          `primary key instead of an id of its own.`
        )
      }
    }
  }
}
