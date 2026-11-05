import { defineEntity, p } from '@mikro-orm/core'
import type { AssetFile } from '@ditojs/storage'

// The files of its columns are in `assetPaths` of the scenario's fixtures.
const AssetWidgetSchema = defineEntity({
  name: 'AssetWidget',
  properties: {
    id: p.integer().primary(),
    files: p.json<AssetFile[]>().onCreate(() => []),
    file: p.json<AssetFile>().nullable(),
    filesSmall: p.json<AssetFile[]>().onCreate(() => [])
  }
})

export class AssetWidget extends AssetWidgetSchema.class {}
AssetWidgetSchema.setClass(AssetWidget)
