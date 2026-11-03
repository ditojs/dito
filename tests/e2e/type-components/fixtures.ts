import { db, defineScenario } from '../../utils/fixture-app.js'
import { Case } from './models/Case.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Case],
  beforeEach: async () => {
    await db.insert(Case, { id: 1 })
  }
})

/** Writes columns of the single `Case` row, by case name. */
export async function setColumns(data: Record<string, unknown>) {
  await db.nativeUpdate(Case, 1, data as never)
}

/** Reads a column of the single `Case` row as database text. */
export async function getColumnText(name: string): Promise<string | null> {
  const em = db.em()
  const meta = em.getMetadata(Case)
  const column = meta.props.find(prop => prop.name === name)!.fieldNames[0]!
  const rows: { value: string | null }[] = await em
    .getConnection()
    .execute('select ??::text as value from ?? where id = 1', [
      column,
      meta.tableName
    ])
  return rows[0]!.value
}
