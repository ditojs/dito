import { Model } from '@ditojs/server'
import { caseEntries } from '../cases/index.js'

/**
 * One column per case, typed like a real app would store the component's value.
 * Tests use a single row, of which each case view edits its own column.
 */
export class Case extends Model {
  static override properties = Object.fromEntries(
    caseEntries.map(({ name, property }) => [
      name,
      { nullable: true, ...property }
    ])
  )
}
