import { mixin } from '@ditojs/utils'
import { TimeStampedMixin } from './TimeStampedMixin.js'

// Asset models are always to be time-stamped:
export const AssetMixin = mixin(Model => class extends TimeStampedMixin(Model) {
  static properties = {
    key: {
      type: 'string',
      required: true,
      unique: true,
      index: true
    },

    file: {
      type: 'object',
      // TODO: Support this on 'object':
      // required: true
      properties: {
        // The unique key within the storage (uuid/v4 + file extension)
        key: {
          type: 'string',
          required: true
        },
        // The original filename, and display name when file is shown
        name: {
          type: 'string',
          required: true
        },
        // The file's mime-type
        type: {
          type: 'string',
          required: true
        },
        // The amount of bytes consumed by the file
        size: {
          type: 'integer',
          required: true
        },
        // Use for storages configured for files to be publically accessible:
        url: {
          type: 'string'
        },
        // These are only used when the storage defines `config.readImageSize`:
        width: {
          type: 'integer'
        },
        height: {
          type: 'integer'
        }
      }
    },

    storage: {
      type: 'string',
      required: true
    },

    count: {
      type: 'integer',
      unsigned: true,
      default: 0
    }
  }

  // @override
  $parseJson(json) {
    const { constructor } = this
    const { file, storage } = json
    // Convert `AssetMixin#file` to an `AssetFile` instance:
    if (file && storage) {
      constructor.app.getStorage(storage)?.convertAssetFile(file)
    }
    return json
  }
})
