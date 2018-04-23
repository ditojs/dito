export const UploadMixin = Model => class extends Model {
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

    controllerUrl: {
      type: 'string',
      required: true
    },

    dataPath: {
      type: 'string',
      required: true
    }
  }
}
