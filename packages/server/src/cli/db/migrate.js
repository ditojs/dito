import pico from 'picocolors'

export async function migrate(knex, config) {
  const [batch, log] = await knex.migrate.latest(config)
  console.info(log.length === 0
    ? pico.cyan('Already up to date')
    : pico.green(`Batch ${batch} run: ${log.length} migrations\n`) +
      pico.cyan(log.join('\n')))
  return true
}
