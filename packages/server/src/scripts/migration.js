import path from 'path'
import fs from 'fs-extra'
import { isObject } from '../utils'
import app from '../app'

const typeToKnex = {
  number: 'double',
  array: 'json',
  object: 'json'
}

const migrationDir = path.join(process.cwd(), 'migrations')

async function createMigration(modelName) {
  const modelClass = app.models[modelName]
  if (!modelClass) {
    throw new Error(`Model class with name '${modelName}' does not exist`)
  }
  const { tableName, properties, relations } = modelClass
  // TODO: Support multiple id columns? Does this even occur?
  const idColumn = modelClass.getIdColumnArray()[0]
  const statements = [`table.increments('${idColumn}').primary()`]
  if (properties) {
    for (const [name, property] of Object.entries(properties)) {
      const column = modelClass.propertyNameToColumnName(name)
      if (column !== idColumn) {
        const { type, computed } = getSchema(property)
        const knexType = typeToKnex[type] || type
        if (!computed) {
          statements.push(`table.${knexType}('${column}')`)
        }
      }
    }
  }
  if (relations) {
    for (const relation of Object.values(relations)) {
      const { join: { from, to } } = relation
      const [, fromColumn] = from && from.split('.') || []
      const [toTable, toColumn] = to && to.split('.') || []
      if (fromColumn && toColumn && fromColumn !== idColumn &&
        !(properties && properties[fromColumn])) {
        statements.push(`table.integer('${fromColumn}').unsigned()
        .references('${toColumn}').inTable('${toTable}')`)
      }
    }
  }
  const file = path.join(migrationDir, `${yyyymmddhhmmss()}_${tableName}.js`)
  await fs.writeFile(file, `export function up(knex) {
  return knex.schema
    .createTable('${tableName}', table => {
      ${statements.join('\n      ')}
    })
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('${tableName}')
}
`)
  process.exit()
}

function getSchema(schema) {
  return isObject(schema) ? schema : { type: schema }
}

// Ensure that we have 2 places for each of the date segments.
function padDate(segment) {
  return segment.toString().padStart(2, '0')
}

// Get a date object in the correct format, without requiring a full out library
// like "moment.js".
function yyyymmddhhmmss() {
  const d = new Date()
  return d.getFullYear().toString() +
    padDate(d.getMonth() + 1) +
    padDate(d.getDate()) +
    padDate(d.getHours()) +
    padDate(d.getMinutes()) +
    padDate(d.getSeconds())
}

createMigration(process.argv[2])
