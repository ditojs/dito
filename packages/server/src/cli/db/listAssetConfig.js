import { parseDataPath, normalizeDataPath } from '@ditojs/utils'

export async function listAssetConfig(app, ...args) {
  const modelNames = args.length > 0 ? args : Object.keys(app.models)
  const assetConfig = {}
  for (const modelName of modelNames) {
    const modelClass = app.models[modelName]
    const { assets } = modelClass.definition
    if (assets) {
      const normalizedModelName = app.normalizeIdentifier(modelName)
      const convertedAssets = {}
      for (const [assetDataPath, config] of Object.entries(assets)) {
        const {
          property,
          nestedDataPath,
          name,
          index
        } = modelClass.getPropertyOrRelationAtDataPath(assetDataPath)
        if (property && index === 0) {
          const normalizedName = app.normalizeIdentifier(name)
          const dataPath = normalizeDataPath([
            normalizedName,
            ...parseDataPath(nestedDataPath)
          ])
          const assetConfigs = convertedAssets[normalizedName] ||= {}
          assetConfigs[dataPath] = config
        } else {
          console.error('Nested graph properties are not supported yet')
          return false
        }
      }
      assetConfig[normalizedModelName] = convertedAssets
    }
  }
  console.log(JSON.stringify(assetConfig, null, 2))
  return true
}
