import pico from 'picocolors'

export async function findOrphanedFiles(app, ...args) {
  const remove = args.includes('--remove')
  const olderThan = args
    .find(arg => arg.startsWith('--older-than='))
    ?.slice('--older-than='.length)
  const storages = args.filter(arg => !arg.startsWith('--'))
  const files = await app.findOrphanedFiles({
    remove,
    ...(olderThan && { olderThan }),
    ...(storages.length > 0 && { storages })
  })
  for (const { storage, key, lastModified, error } of files) {
    console.info(
      `File ${pico.green(`'${key}'`)} of storage ${
        pico.green(`'${storage}'`)
      }: modified ${lastModified.toISOString()}${
        error ? `, ${pico.red(`unable to remove: ${error.message}`)}` : ''
      }`
    )
  }
  const failed = files.filter(file => file.error)
  console.info(
    remove
      ? `Removed ${files.length - failed.length} orphaned files, unable to ` +
        `remove ${failed.length}.`
      : `Found ${files.length} orphaned files.`
  )
  return failed.length === 0
}
