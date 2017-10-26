import path from 'path'
import fs from 'fs-extra'
import { isArray } from '@/utils'

const typeToKnex = {
  number: 'double',
  array: 'json',
  object: 'json'
}

const defaultValues = {
  'now()': `knex.raw('CURRENT_TIMESTAMP')`
}

const migrationDir = path.join(process.cwd(), 'migrations')

export async function createMigration(app, modelName) {
  function getModel(modelName) {
    const modelClass = app.models[modelName]
    if (!modelClass) {
      throw new Error(`Model class with name '${modelName}' does not exist`)
    }
    return modelClass
  }

  const modelClass = getModel(modelName)
  const { tableName } = modelClass
  const { properties = {}, relations = {} } = modelClass.definition
  const statements = []
  for (const [name, property] of Object.entries(properties)) {
    const column = modelClass.propertyNameToColumnName(name)
    let {
      type, computed, default: _default, primary, unique, required, nullable
    } = property
    const knexType = typeToKnex[type] || type
    if (!computed) {
      const statement = primary
        ? [`table.increments('${column}').primary()`]
        : [`table.${knexType}('${column}')`]
      if (unique) {
        statement.push('unique()')
      }
      if (required) {
        statement.push('notNullable()')
      } else if (nullable) {
        statement.push('nullable()')
      }
      if (_default) {
        _default = defaultValues[_default] || _default
        _default = isArray(_default) ? `[${_default.join(', ')}]` : _default
        statement.push(`defaultTo(${_default})`)
      }
      statements.push(statement.join('.'))
    }
    for (const relation of Object.values(relations)) {
      const { join: { from, to } } = relation
      const [, fromProperty] = from && from.split('.') || []
      const [toModelName, toProperty] = to && to.split('.') || []
      if (fromProperty && toProperty &&
        !(properties && properties[fromProperty])) {
        const toModelClass = getModel(toModelName)
        const fromColumn = modelClass.propertyNameToColumnName(fromProperty)
        const toColumn = modelClass.propertyNameToColumnName(toProperty)
        statements.push(
          `table.integer('${fromColumn}').unsigned()`,
          `  .references('${toColumn}').inTable('${toModelClass.tableName}')`
        )
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
