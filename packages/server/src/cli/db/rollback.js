import pico from 'picocolors'

export async function rollback(knex) {
  const [batch, log] = await knex.migrate.rollback()
  console.info(log.length === 0
    ? pico.cyan('Already at the base migration')
    : pico.green(`Batch ${batch} rolled back: ${log.length} migrations\n`) +
      pico.cyan(log.join('\n')))
  return true
}
