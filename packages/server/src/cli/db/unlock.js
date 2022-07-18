import pico from 'picocolors'

export async function unlock(knex) {
  await knex.migrate.forceFreeMigrationsLock()
  console.info(
    pico.green(`Successfully unlocked the migrations lock table`)
  )
  return true
}
