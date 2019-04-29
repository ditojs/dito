import chalk from 'chalk'

export async function migrate(knex) {
  const [batch, log] = await knex.migrate.latest()
  console.log(log.length === 0
    ? chalk.cyan('Already up to date')
    : chalk.green(`Batch ${batch} run: ${log.length} migrations\n`) +
      chalk.cyan(log.join('\n')))
  return true
}
