import pico from 'picocolors'

export async function findOrphanedFiles(app, ...args) {
  const remove = args.includes('--remove')
  const files = await app.findOrphanedFiles({ remove })
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
    `${remove ? 'Removed' : 'Found'} ${
      files.length - failed.length
    } orphaned files.`
  )
  return failed.length === 0
}
