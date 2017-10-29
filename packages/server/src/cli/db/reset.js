import Knex from 'knex'
import chalk from 'chalk'
import { migrate } from './migrate'

export async function reset(config) {
  const knex = Knex(config.knex)
  const batches = []
  const migrations = []
  while (true) {
    const [batch, log] = await knex.migrate.rollback()
    if (log.length === 0) break
    batches.push(batch)
    migrations.push(...log)
  }
  console.log(migrations.length === 0
    ? chalk.cyan('Already at the base migration')
    : chalk.green(`${batches.length > 1 ? 'Batches' : 'Batch'} ${batches} ` +
      `rolled back: ${migrations.length} migrations\n`) +
      chalk.cyan(migrations.join('\n')))
  await migrate(config)
  return true // done
}
