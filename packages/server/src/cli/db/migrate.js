import Knex from 'knex'
import chalk from 'chalk'

export default function migrate(config) {
  return new Promise((resolve, reject) => {
    Knex(config.knex).migrate.latest().spread((batchNo, log) => {
      if (log.length === 0) {
        resolve(chalk.cyan('Already up to date'))
      }
      resolve(
        chalk.green(`Batch ${batchNo} run: ${log.length} migrations\n`) +
        chalk.cyan(log.join('\n'))
      )
    }).catch(reject)
  })
}
