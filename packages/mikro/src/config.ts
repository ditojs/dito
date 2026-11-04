import {
  Cascade,
  ChangeSetType,
  DateType,
  EntitySchema,
  ReferenceKind,
  UnderscoreNamingStrategy,
  Utils,
  wrap,
  type EntityMetadata,
  type ChangeSet,
  type EntityProperty,
  type EventArgs,
  type EntityManager,
  type EventSubscriber,
  type FlushEventArgs,
  type MetadataStorage,
  type Options
} from '@mikro-orm/core'
import { isArray } from '@ditojs/utils'
import { PlainDate } from './plain-date.ts'
import { SchemaJson, runSchema } from './schema-json.ts'

// The options of `new MikroORM()` for entities of Dito: `p.date()` columns keep
// the local day, new rows get the defaults of their `schemaJson()` schemas, and
// `em.remove()` deletes owned rows and follows the delete rules of foreign
// keys. Pivot entities with an id of their own log a warning. `entities` can be
// a module of them, like in `getAssetPaths()`.
//
//   const orm = new MikroORM(mikroOptions({ dbName, entities }))
export function mikroOptions<T extends Partial<Options<any, any, any>>>(
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

// Whether `mikroOptions()` created the entity manager's ORM.
export const hasMikroOptions = (em: EntityManager) =>
  [...em.getEventManager().getSubscribers()].some(
    subscriber => subscriber instanceof RemovedRows
  )

// Leaves out what else a module of entities exports.
const getEntities = (entities: object) =>
  isArray(entities) ? entities : Object.values(entities).filter(isEntity)

const isEntity = (value: unknown) => (
  value instanceof EntitySchema || EntitySchema.REGISTRY.has(value as never)
)

// Makes `em.remove()` delete what the schema says. MikroORM deletes owned rows
// only when they are loaded, so a flush loads them first. And it sets the
// foreign keys of the loaded rows of a one-to-many relation to null, whatever
// their delete rule says, so a flush puts them back. The database then applies
// the rule and may refuse the delete, which leaves the rows as they were. Only
// `set null` stays with MikroORM, on the rows that the remove keeps.
class RemovedRows implements EventSubscriber {
  async beforeFlush({ em, uow }: FlushEventArgs) {
    for (const entity of uow.getRemoveStack()) {
      const wrapped = wrap(entity, true)
      if (wrapped.__managed) {
        await em.populate(
          entity,
          getOwnedPaths(wrapped.__meta) as never[],
          { filters: false }
        )
      }
    }
  }

  onFlush({ uow }: FlushEventArgs) {
    const removed = uow.getRemoveStack()
    if (removed.size === 0) return
    const changes = new Map(uow.getChangeSets().map(cs => [cs.entity, cs]))
    for (const entity of removed) {
      for (const prop of wrap(entity, true).__meta.relations) {
        const foreignKey = getDetachedKey(prop)
        const rows = entity[prop.name as never]
        if (!foreignKey || !Utils.isCollection(rows)) continue
        const { name, deleteRule } = foreignKey
        for (const row of rows.getItems(false) as any[]) {
          const isKept = deleteRule !== 'set null' || removed.has(row)
          if (isKept && row[name] == null) {
            row[name] = entity
            const change = changes.get(row)
            if (change) restoreForeignKey(change, name, entity)
          }
        }
      }
    }
  }
}

// The nullable foreign key of a one-to-many relation.
function getDetachedKey({ kind, mappedBy, targetMeta }: EntityProperty) {
  const foreignKey =
    kind === ReferenceKind.ONE_TO_MANY ? targetMeta!.properties[mappedBy] : null
  return foreignKey?.nullable ? foreignKey : null
}

// A new row inserts the key. A row without other changes writes nothing, not
// even the values of `onUpdate`, which the detached key set off.
function restoreForeignKey(
  { type, payload, meta, entity: row, originalEntity }: ChangeSet<any>,
  name: string,
  entity: object
) {
  if (type === ChangeSetType.CREATE) {
    payload[name] = wrap(entity, true).getPrimaryKey()
    return
  }
  delete payload[name]
  const names = Object.keys(payload)
  if (names.every(name => meta.properties[name]?.onUpdate)) {
    for (const name of names) {
      const value = originalEntity?.[name]
      const isDate = meta.properties[name]!.runtimeType === 'Date'
      row[name] = isDate && value != null ? new Date(value as string) : value
      delete payload[name]
    }
  }
}

// The paths of the relations whose rows a remove deletes with the row, as
// MikroORM decides it: relations with `orphanRemoval` or a cascade of removes,
// such as `chapters.sections`. A relation back to an entity of the path is left
// out, so the rows of a tree of one entity need the delete rule `cascade` on
// their foreign key, or the database refuses the delete of a row with children.
function getOwnedPaths(
  meta: EntityMetadata,
  prefix = '',
  seen = new Set<string>([meta.className])
): string[] {
  const paths: string[] = []
  for (const prop of meta.relations) {
    const cascades = (
      prop.orphanRemoval ||
      prop.cascade?.some(
        type => type === Cascade.REMOVE || type === Cascade.ALL
      )
    )
    const target = prop.targetMeta!
    if (!cascades || seen.has(target.className)) continue
    const path = `${prefix}${prop.name}`
    paths.push(
      path,
      ...getOwnedPaths(target, `${path}.`, new Set([...seen, target.className]))
    )
  }
  return paths
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
  return getEntities(entities).flatMap(entity => {
    const { meta } =
      entity instanceof EntitySchema
        ? entity
        : EntitySchema.REGISTRY.get(entity)!
    const table = meta.tableName ?? naming.classToTableName(meta.className)
    return Object.entries(meta.properties).flatMap(([name, prop]) => {
      const type = prop.customType ?? prop.type
      if (!(type instanceof SchemaJson)) return []
      const column = prop.fieldNames?.[0] ?? naming.propertyToColumnName(name)
      return type.assets.map(asset => ({ table, column, ...asset }))
    })
  })
}
