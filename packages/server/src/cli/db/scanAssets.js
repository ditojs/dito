import pico from 'picocolors'

export async function scanAssets(app, ...args) {
  const dryRun = args.includes('--dry-run')
  const { referenced, unreferenced, missing, lost } = await app.scanAssets({
    dryRun
  })
  for (const asset of referenced) {
    console.info(
      `Asset ${pico.green(`'${asset.file.name}'`)} (${asset.key}): referenced`
    )
  }
  for (const asset of unreferenced) {
    console.info(
      `Asset ${pico.green(`'${asset.file.name}'`)} (${asset.key}): unreferenced`
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
    `${dryRun ? 'Would mark' : 'Marked'} ${referenced.length} assets as ` +
    `referenced and ${unreferenced.length} as unreferenced, ${
      dryRun ? 'would create' : 'created'
    } ${missing.length} missing assets, found ${lost.length} lost files.`
  )
  return true
}
