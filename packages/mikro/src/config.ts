import {
  DateType,
  EntitySchema,
  ReferenceKind,
  UnderscoreNamingStrategy,
  type EventArgs,
  type EventSubscriber,
  type MetadataStorage,
  type Options
} from '@mikro-orm/core'
import { PlainDate } from './plain-date.ts'
import { SchemaJson, runSchema } from './schema-json.ts'

// The options of `new MikroORM()` for entities of Dito: `p.date()` columns keep
// the local day, and new rows get the defaults of their `schemaJson()` schemas.
// Pivot entities with an id of their own log a warning.
//
//   const orm = new MikroORM(mikroOptions({ dbName, entities }))
export function mikroOptions<T extends Partial<Options<any, any, any>>>(
  options: T
): T {
  const { discovery, subscribers = [] } = options
  return {
    ...options,
    subscribers: [...subscribers, new SchemaDefaults()],
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
}

// Fills the defaults of the schemas of new rows. The write check only
// validates, so this parses the values again and keeps the output: a new value,
// as MikroORM compares the values before and after hooks.
class SchemaDefaults implements EventSubscriber {
  async beforeCreate({ entity, meta }: EventArgs<any>) {
    for (const prop of meta.props) {
      const { customType } = prop
      const value = entity[prop.name]
      if (
        customType instanceof SchemaJson &&
        customType.schema &&
        value != null
      ) {
        const result = await runSchema(customType.schema, value)
        if (!result.issues) entity[prop.name] = result.value
      }
    }
  }
}

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

// The asset paths of `@ditojs/storage`, from the `assets` of the JSON columns
// of `entities`, classes or a module of them. It reads the definitions, so it
// needs no ORM. Names follow MikroORM's default naming strategy.
export function getAssetPaths(entities: object) {
  const naming = new UnderscoreNamingStrategy()
  return Object.values(entities).flatMap(entity => {
    const schema =
      entity instanceof EntitySchema
        ? entity
        : EntitySchema.REGISTRY.get(entity)
    if (!schema) return []
    const { meta } = schema
    const table = meta.tableName ?? naming.classToTableName(schema.name)
    return Object.entries(meta.properties).flatMap(([name, prop]) => {
      const type = prop.customType ?? prop.type
      if (!(type instanceof SchemaJson)) return []
      const column = prop.fieldNames?.[0] ?? naming.propertyToColumnName(name)
      return type.assets.map(asset => ({ table, column, ...asset }))
    })
  })
}
