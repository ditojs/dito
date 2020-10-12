import chalk from 'chalk'

export async function unlock(knex) {
  await knex.migrate.forceFreeMigrationsLock()
  console.info(
    chalk.green(`Successfully unlocked the migrations lock table`)
  )
  return true
}
