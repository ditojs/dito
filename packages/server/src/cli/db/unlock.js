import pico from 'picocolors'

export async function unlock(knex, config) {
  await knex.migrate.forceFreeMigrationsLock(config)
  console.info(
    pico.green(`Successfully unlocked the migrations lock table`)
  )
  return true
}
