import type { ViewSchema } from '@ditojs/admin'
import type { AssetWidget } from
  '../../models/AssetWidget.js'
import type { NestedAssetWidget } from
  '../../models/NestedAssetWidget.js'
import { createWidgetView } from
  '../../../schema-components/app/views/createWidgetView.js'

export const assets = createWidgetView<AssetWidget>(
  'Asset Widget',
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
