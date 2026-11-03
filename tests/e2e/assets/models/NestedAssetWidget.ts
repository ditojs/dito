import { defineEntity, p } from '@mikro-orm/core'
import type { AssetFileObject } from '@ditojs/storage'

export interface Section {
  items: {
    items: {
      image: AssetFileObject | null
    }[]
  }[]
}

// The files of its sections are in `assetPaths` of the scenario's fixtures.
const NestedAssetWidgetSchema = defineEntity({
  name: 'NestedAssetWidget',
  properties: {
    id: p.integer().primary(),
    sections: p.json<Section[]>().onCreate(() => [])
  }
})

export class NestedAssetWidget extends NestedAssetWidgetSchema.class {}
NestedAssetWidgetSchema.setClass(NestedAssetWidget)
