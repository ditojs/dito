export const AssetMixin = Model => class extends Model {
  static properties = {
    fileName: {
      type: 'string',
      required: true,
      unique: true,
      index: true
    },

    file: {
      type: 'object'
      // TODO: Support this on 'object'
      // required: true
    },

    storageName: {
      type: 'string',
      required: true
    },

    refCount: {
      type: 'integer',
      unsigned: true,
      default: 0
    }
  }
}
