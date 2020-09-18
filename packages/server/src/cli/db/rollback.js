import chalk from 'chalk'

export async function rollback(knex) {
  const [batch, log] = await knex.migrate.rollback()
  console.info(log.length === 0
    ? chalk.cyan('Already at the base migration')
    : chalk.green(`Batch ${batch} rolled back: ${log.length} migrations\n`) +
      chalk.cyan(log.join('\n')))
  return true
}
