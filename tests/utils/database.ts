// tests/utils/database.ts
import type { Knex } from 'knex'
import type { Application } from '@ditojs/server'

interface PropertyDefinition {
  type?: string
  primary?: boolean
  nullable?: boolean
  index?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestApp = Application & { knex: Knex }

export async function createTestDatabase(
  app: TestApp,
  ...modelClasses: any[]
) {
  const models = modelClasses.length
    ? modelClasses
    : Object.values(app.models)
  for (const modelClass of models) {
    const { properties } = modelClass.definition
    await app.knex.schema.createTable(
      modelClass.tableName,
      (table: Knex.CreateTableBuilder) => {
        for (const [name, property] of Object.entries(
          properties as Record<
            string, PropertyDefinition
          >
        )) {
          if (name === '#id' || name === '#ref') {
            continue
          }
          addColumn(table, name, property)
        }
      }
    )
  }
}

function addColumn(
  table: Knex.CreateTableBuilder,
  name: string,
  property: PropertyDefinition
) {
  const { type } = property
  let column: Knex.ColumnBuilder

  if (property.primary) {
    column = table.increments(name).primary()
    return column
  }

  switch (type) {
    case 'string':
      column = table.text(name)
      break
    case 'text':
      column = table.text(name)
      break
    case 'integer':
      column = table.integer(name)
      break
    case 'number':
      column = table.float(name)
      break
    case 'boolean':
      column = table.boolean(name)
      break
    case 'date':
      column = table.date(name)
      break
    case 'datetime':
      column = table.datetime(name)
      break
    case 'timestamp':
      column = table.timestamp(name)
      break
    case 'object':
      column = table.jsonb(name)
      break
    case 'array':
      column = table.jsonb(name)
      break
    default:
      column = table.text(name)
  }

  if (property.nullable !== false) {
    column.nullable()
  } else {
    column.notNullable()
  }

  if (property.index) {
    column.index()
  }

  return column
}
