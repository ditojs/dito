import { defineEntity, p } from '@mikro-orm/core'
import type { AssetFileObject } from '@ditojs/storage'

// The files of its columns are in `assetPaths` of the scenario's fixtures.
const AssetWidgetSchema = defineEntity({
  name: 'AssetWidget',
  properties: {
    id: p.integer().primary(),
    files: p.json<AssetFileObject[]>().onCreate(() => []),
    file: p.json<AssetFileObject>().nullable(),
    filesSmall: p.json<AssetFileObject[]>().onCreate(() => [])
  }
})

export class AssetWidget extends AssetWidgetSchema.class {}
AssetWidgetSchema.setClass(AssetWidget)
