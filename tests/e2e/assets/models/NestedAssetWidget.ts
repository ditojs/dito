import { defineEntity, p } from '@mikro-orm/core'
import type { AssetFile } from '@ditojs/storage'

export interface Section {
  items: {
    items: {
      image: AssetFile | null
    }[]
  }[]
}

// The files of its sections are in `assetFields` of the scenario's fixtures.
const NestedAssetWidgetSchema = defineEntity({
  name: 'NestedAssetWidget',
  properties: {
    id: p.integer().primary(),
    sections: p.json<Section[]>().onCreate(() => [])
  }
})

export class NestedAssetWidget extends NestedAssetWidgetSchema.class {}
NestedAssetWidgetSchema.setClass(NestedAssetWidget)
