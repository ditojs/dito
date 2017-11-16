import path from 'path'
import fs from 'fs-extra'
import { isObject, isArray, isString, deindent } from '@/utils'

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
  const tableName = app.normalizeIdentifier(modelClass.tableName)
  const { properties = {}, relations = {} } = modelClass.definition
  const statements = []
  // TODO: Instead of looping through properties first and relations after,
  // merge both so that foreign key properties can have `unique()`, `nullable()`
  // and still profit from the generation of `references().inTable()`.
  const uniqueComposites = {}
  for (const [name, property] of Object.entries(properties)) {
    const column = app.normalizeIdentifier(name)
    let {
      description, type, unsigned, computed, nullable, required,
      primary, foreign, unique, index,
      default: _default
    } = property
    const knexType = typeToKnex[type] || type
    if (!computed) {
      if (description) {
        statements.push(`// ${description}`)
      }
      if (isString(unique)) {
        const composites = uniqueComposites[unique] ||
          (uniqueComposites[unique] = [])
        composites.push(column)
        unique = false
      }
      const statement = primary
        ? [`table.increments('${column}').primary()`]
        : [`table.${knexType}('${column}')`]
      statement.push(
        unsigned && 'unsigned()',
        !primary && required && 'notNullable()',
        nullable && 'nullable()',
        unique && 'unique()',
        index && 'index()'
      )
      if (_default) {
        let value = defaultValues[_default]
        if (!value) {
          value = isArray(_default) || isObject(_default)
            ? JSON.stringify(_default)
            : _default
          if (isString(value)) {
            value = `'${value}'`
          }
        }
        statement.push(`defaultTo(${value})`)
      }
      if (foreign) {
        for (const relation of Object.values(relations)) {
          // TODO: Support composite keys for foreign references:
          // Use `asArray(from)`, `asArray(to)`
          const { from, to } = relation
          const [, fromProperty] = from && from.split('.') || []
          if (fromProperty === name) {
            const [toModelName, toProperty] = to && to.split('.') || []
            statement.push(
              '\n',
              `references('${app.normalizeIdentifier(toProperty)}')`,
              `inTable('${app.normalizeIdentifier(toModelName)}')`,
              `onDelete('CASCADE')`
            )
          }
          // TODO: Handle relations that have `through: true`, and auto-create
          // the trough table in those cases.
        }
      }
      statements.push(statement.filter(str => !!str).join('.')
        .replace(/\.\n\./g, '\n  .'))
    }
  }
  for (const composites of Object.values(uniqueComposites)) {
    statements.push(`table.unique([${
      composites.map(column => `'${column}'`).join(', ')
    }])`)
  }
  const file = path.join(migrationDir, `${yyyymmddhhmmss()}_${tableName}.js`)
  await fs.writeFile(file, deindent`
    export function up(knex) {
      return knex.schema
        .createTable('${tableName}', table => {
          ${statements.join('\n')}
        })
    }

    export function down(knex) {
      return knex.schema
        .dropTableIfExists('${tableName}')
    }
  `)
  return true // done
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
