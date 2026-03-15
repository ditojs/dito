import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface AssetWidget {
  id: number
  files: object[] | null
  file: object | null
  filesSmall: object[] | null
}

export class AssetWidget extends Model {
  static override properties: ModelProperties = {
    files: {
      type: 'array',
      items: { type: 'object' },
      default: []
    },
    file: {
      type: 'object',
      nullable: true
    },
    filesSmall: {
      type: 'array',
      items: { type: 'object' },
      default: []
    }
  }

  static assets = {
    files: { storage: 'test' },
    file: { storage: 'test' },
    filesSmall: { storage: 'test' }
  }
}
