import type { ViewSchema } from '@ditojs/admin'
import type { AssetWidget } from './models/AssetWidget.js'
import type { NestedAssetWidget } from './models/NestedAssetWidget.js'
import { createWidgetView } from '../../utils/views.js'

export const assets = createWidgetView<AssetWidget>(
  'files',
  'asset-widgets',
  {
    files: {
      type: 'upload',
      extensions: 'gif,jpg,jpeg,png,webp',
      maxSize: '10mb',
      multiple: true,
      draggable: true,
      deletable: true
    },
    file: {
      type: 'upload',
      extensions: 'gif,jpg,jpeg,png,webp',
      maxSize: '10mb',
      multiple: false,
      deletable: true
    },
    filesSmall: {
      type: 'upload',
      extensions: 'gif,jpg,jpeg,png,webp',
      maxSize: '100b',
      multiple: true
    }
  }
)

// Forms that download their data with its files as a zip, and upload it again:
export const interchange: ViewSchema<AssetWidget> = {
  type: 'view',
  component: {
    type: 'list',
    itemLabel: 'files',
    resource: { path: 'asset-widgets' },
    editable: true,
    form: {
      type: 'form',
      clipboard: { interchange: true },
      components: {
        files: {
          type: 'upload',
          extensions: 'gif,jpg,jpeg,png,webp',
          multiple: true
        },
        file: {
          type: 'upload',
          extensions: 'gif,jpg,jpeg,png,webp'
        }
      }
    }
  }
}

export const nestedAssets: ViewSchema<NestedAssetWidget> = {
  type: 'view',
  component: {
    type: 'list',
    itemLabel: 'sections',
    resource: { path: 'nested-asset-widgets' },
    editable: true,
    form: {
      type: 'form',
      components: {
        sections: {
          type: 'list',
          label: 'Sections',
          inlined: true,
          creatable: true,
          form: {
            type: 'form',
            components: {
              items: {
                type: 'list',
                label: 'Items',
                inlined: true,
                creatable: true,
                form: {
                  type: 'form',
                  components: {
                    items: {
                      type: 'list',
                      label: 'Sub-items',
                      inlined: true,
                      creatable: true,
                      form: {
                        type: 'form',
                        components: {
                          image: {
                            type: 'upload',
                            extensions: 'png',
                            maxSize: '10mb',
                            multiple: false
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
