export async function listAssetConfig(app, ...args) {
  const assetConfig = app.getAssetConfig({
    models: args.length > 0 ? args : Object.keys(app.models),
    normalizeDbNames: true
  })
  console.log(JSON.stringify(assetConfig, null, 2))
  return true
}
