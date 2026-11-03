import { defineEntity, p } from '@mikro-orm/core'
import { caseEntries } from '../cases/index.js'

// The column of each property type of the cases. Arrays and objects with a
// `default` get it on insert.
function getColumn({ type, default: value }: Record<string, unknown>) {
  switch (type) {
    case 'string':
      return p.string().nullable()
    case 'text':
      return p.text().nullable()
    case 'number':
      return p.double().nullable()
    case 'integer':
      return p.integer().nullable()
    case 'boolean':
      return p.boolean().nullable()
    case 'date':
      return p.date().nullable()
    case 'datetime':
      return p.datetime().nullable()
    case 'array':
    case 'object':
      return value === undefined
        ? p.json().nullable()
        : p
            .json()
            .nullable()
            .onCreate(() => structuredClone(value))
    default:
      throw new Error(`Unknown property type: ${type}`)
  }
}

/**
 * One column per case, typed like a real app would store the component's value.
 * Tests use a single row, of which each case view edits its own column.
 */
const CaseSchema = defineEntity({
  name: 'Case',
  properties: {
    id: p.integer().primary(),
    ...Object.fromEntries(
      caseEntries.map(({ name, property }) => [name, getColumn(property)])
    )
  }
})
export class Case extends CaseSchema.class {}
CaseSchema.setClass(Case)
