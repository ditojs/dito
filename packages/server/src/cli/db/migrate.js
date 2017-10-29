import Knex from 'knex'
import chalk from 'chalk'

export async function migrate(config) {
  const [batch, log] = await Knex(config.knex).migrate.latest()
  console.log(log.length === 0
    ? chalk.cyan('Already up to date')
    : chalk.green(`Batch ${batch} run: ${log.length} migrations\n`) +
      chalk.cyan(log.join('\n')))
  return true // done
}
