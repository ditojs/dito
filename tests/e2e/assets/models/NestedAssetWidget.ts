import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface NestedAssetWidget {
  id: number
  sections: {
    items: {
      items: {
        image: object | null
      }[]
    }[]
  }[]
}

export class NestedAssetWidget extends Model {
  static override properties: ModelProperties = {
    sections: {
      type: 'array',
      items: { type: 'object' },
      default: []
    }
  }

  static assets = {
    'sections[*].items[*].items[*].image': {
      storage: 'test'
    }
  }
}
