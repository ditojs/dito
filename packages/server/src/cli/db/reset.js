import pico from 'picocolors'
import { migrate } from './migrate.js'

export async function reset(knex) {
  const batches = []
  const migrations = []
  while (true) {
    const [batch, log] = await knex.migrate.rollback()
    if (log.length === 0) break
    batches.push(batch)
    migrations.push(...log)
  }
  console.info(migrations.length === 0
    ? pico.cyan('Already at the base migration')
    : pico.green(`${batches.length > 1 ? 'Batches' : 'Batch'} ${batches} ` +
      `rolled back: ${migrations.length} migrations\n`) +
      pico.cyan(migrations.join('\n')))
  await migrate(knex)
  return true
}
