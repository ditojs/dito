import { formatJson } from '@ditojs/server'

export async function listAssetConfig(app, ...args) {
  const assetConfig = app.getAssetConfig({
    models: args.length > 0 ? args : Object.keys(app.models),
    normalizeDbNames: true
  })
  console.info(formatJson(assetConfig))
  return true
}
