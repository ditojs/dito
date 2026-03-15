import type { AssetWidget } from
  '../../models/AssetWidget.js'
import { createWidgetView } from
  '../../../schema-components/app/views/createWidgetView.js'

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
