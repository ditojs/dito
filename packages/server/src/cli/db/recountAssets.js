import pico from 'picocolors'

export async function recountAssets(app, ...args) {
  const dryRun = args.includes('--dry-run')
  const { changed, missing, lost } = await app.recountAssets({ dryRun })
  for (const { asset, count } of changed) {
    console.info(
      `Asset ${
        pico.green(`'${asset.file.name}'`)
      } (${asset.key}): count ${asset.count} → ${count}`
    )
  }
  for (const { key, references } of missing) {
    console.info(
      `Asset ${
        pico.green(`'${references[0].file.name}'`)
      } (${key}): missing, ${references.length} references`
    )
  }
  for (const { key, references } of lost) {
    console.info(
      `Asset ${
        pico.red(`'${references[0].file.name}'`)
      } (${key}): lost from storage ${
        pico.red(`'${references[0].storage}'`)
      }, ${references.length} references: ${
        references
          .map(({ model, id, dataPath }) => `${model} ${id} ${dataPath}`)
          .join(', ')
      }`
    )
  }
  console.info(
    `${dryRun ? 'Would change' : 'Changed'} ${changed.length} counts, ${
      dryRun ? 'would create' : 'created'
    } ${missing.length} missing assets, found ${lost.length} lost files.`
  )
  return true
}
