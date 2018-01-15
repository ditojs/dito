import path from 'path'
import fs from 'fs-extra'
import { isObject, isArray, isString, deindent, capitalize } from '@ditojs/utils'

const typeToKnex = {
  number: 'double',
  array: 'json',
  object: 'json'
}

const defaultValues = {
  'now()': `knex.raw('CURRENT_TIMESTAMP')`
}

const migrationDir = path.join(process.cwd(), 'migrations')

export async function createMigration(app, name, ...modelNames) {
  const models = modelNames.map(modelName => {
    const modelClass = app.models[modelName]
    if (!modelClass) {
      throw new Error(`Model class with name '${modelName}' does not exist`)
    }
    return modelClass
  })
  const tables = []
  for (const modelClass of models) {
    collectModelTables(modelClass, app, tables)
  }
  for (const modelClass of models) {
    collectThroughTables(modelClass, app, tables)
  }
  const createTables = []
  const dropTables = []
  for (const { tableName, statements } of tables) {
    createTables.push(deindent`
      .createTable('${tableName}', table => {
        ${statements.join('\n')}
      })`)
    dropTables.unshift(deindent`
      .dropTableIfExists('${tableName}')`)
  }
  const file = path.join(migrationDir, `${yyyymmddhhmmss()}_${name}.js`)
  await fs.writeFile(file, deindent`
    export function up(knex) {
      return knex.schema
        ${createTables.join('\n')}
    }

    export function down(knex) {
      return knex.schema
        ${dropTables.join('\n')}
    }
  `)
  return true // done
}

async function collectModelTables(modelClass, app, tables) {
  const tableName = app.normalizeIdentifier(modelClass.tableName)
  const { properties = {}, relations = {} } = modelClass.definition
  const statements = []
  tables.push({ tableName, statements })
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
        // To declare composite foreign keys as unique, you can give each
        // property the same string value in the `unique` keywords, e.g.:
        // `unique: 'customerId_name'
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
      if (_default !== undefined) {
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
          const [fromClass, fromProperty] = from?.split('.') || []
          if (fromProperty === name) {
            if (fromClass !== modelClass.name) {
              throw Error(`Invalid relation declaration: ${relation}`)
            }
            const [toClass, toProperty] = to?.split('.') || []
            statement.push(
              '\n',
              `references('${app.normalizeIdentifier(toProperty)}')`,
              `inTable('${app.normalizeIdentifier(toClass)}')`,
              `onDelete('CASCADE')`
            )
          }
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
}

async function collectThroughTables(modelClass, app, tables) {
  const { relations = {} } = modelClass.definition
  for (const relation of Object.values(relations)) {
    const { from, to, through, inverse } = relation
    if (through === true && !inverse) {
      // TODO: Support composite keys for foreign references:
      // Use `asArray(from)`, `asArray(to)`
      const [fromClass, fromProperty] = from?.split('.') || []
      const [toClass, toProperty] = to?.split('.') || []
      const statements = []
      // See convertRelations()
      const tableName = app.normalizeIdentifier(`${fromClass}${toClass}`)
      const fromId = app.normalizeIdentifier(
        `${fromClass}${capitalize(fromProperty)}`)
      const toId = app.normalizeIdentifier(
        `${toClass}${capitalize(toProperty)}`)
      tables.push({ tableName, statements })
      statements.push(`table.increments('id').primary()`)
      statements.push(deindent`
        table.integer('${fromId}').unsigned().index()
          .references('${app.normalizeIdentifier(fromProperty)}')\\
          .inTable('${app.normalizeIdentifier(fromClass)}')\\
          .onDelete('CASCADE')`)
      statements.push(deindent`
        table.integer('${toId}').unsigned().index()
          .references('${app.normalizeIdentifier(toProperty)}')\\
          .inTable('${app.normalizeIdentifier(toClass)}')\\
          .onDelete('CASCADE')`)
    }
  }
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
