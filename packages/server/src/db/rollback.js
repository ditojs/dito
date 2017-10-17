import Knex from 'knex'
import chalk from 'chalk'

export function rollback(config) {
  return new Promise((resolve, reject) => {
    Knex(config.knex).migrate.rollback().spread((batchNo, log) => {
      if (log.length === 0) {
        resolve(chalk.cyan('Already up to date'))
      }
      resolve(
        chalk.green(`Batch ${batchNo} rolled back: ${log.length} migrations \n`) +
        chalk.cyan(log.join('\n'))
      )
    }).catch(reject)
  })
}
