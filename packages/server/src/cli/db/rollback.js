import Knex from 'knex'
import chalk from 'chalk'

export async function rollback(config) {
  const [batch, log] = await Knex(config.knex).migrate.rollback()
  console.log(log.length === 0
    ? chalk.cyan('Already at the base migration')
    : chalk.green(`Batch ${batch} rolled back: ${log.length} migrations\n`) +
      chalk.cyan(log.join('\n')))
}
