<template lang="pug">
.dito-upload
  //- In order to handle upload buttons in multiple possible places, depending
  //- on whether they handle single or multiple uploads, render the upload
  //- component invisibly at the root, and delegate the click events to it from
  //- the buttons rendered further below. Luckily this works surprisingly well.
  VueUpload.dito-upload__input(
    ref="upload"
    v-model="uploads"
    :inputId="dataPath"
    :name="dataPath"
    :disabled="disabled"
    :postAction="uploadPath"
    :extensions="extensions"
    :accept="accept"
    :multiple="multiple"
    :size="maxSize"
    :drop="$el?.closest('.dito-container')"
    :dropDirectory="true"
    @input-filter="onInputFilter"
    @input-file="onInputFile"
  )
  table.dito-table.dito-table--separators.dito-table--background
    //- Styling comes from `DitoTableHead`
    thead.dito-table-head
      tr
        th
          span File
        th
          span Size
        th
          span Status
        th
          span
    DitoDraggable(
      v-model="files"
      as="tbody"
      :options="getDraggableOptions()"
      :draggable="draggable"
    )
      template(
        v-if="multiple || !isUploadActive"
      )
        tr(
          v-for="(file, index) in files"
          :key="file.name"
        )
          td(
            v-if="render"
            v-html="renderFile(file, index)"
          )
          td(
            v-else-if="downloadUrls[index]"
          )
            a(
              :download="file.name"
              :href="downloadUrls[index]"
              target="_blank"
              @click.prevent="onClickDownload(file, index)"
            )
              DitoUploadFile(
                :file="file"
                :thumbnail="thumbnails"
                :thumbnailUrl="thumbnailUrls[index]"
              )
          td(
            v-else
          )
            DitoUploadFile(
              :file="file"
              :thumbnail="thumbnails"
              :thumbnailUrl="thumbnailUrls[index]"
            )
          td.dito-upload__size {{ formatFileSize(file.size) }}
          td.dito-upload__status
            template(
              v-if="file.upload"
            )
              template(
                v-if="file.upload.error"
              )
                | Error: {{ file.upload.error }}
              template(
                v-else-if="file.upload.active"
              )
                | Uploading...
              template(
                v-else-if="file.upload.success"
              )
                | Uploaded
            template(
              v-else
            )
              | Stored
          td.dito-table__buttons
            .dito-buttons.dito-buttons--round
              button.dito-button.dito-button--upload(
                v-if="!multiple"
                :title="uploadTitle"
                @click="onClickUpload"
              )
              //- Firefox doesn't like <button> here, so use <a> instead:
              a.dito-button(
                v-if="draggable"
                v-bind="getButtonAttributes(verbs.drag)"
              )
              button.dito-button(
                v-if="deletable"
                type="button"
                v-bind="getButtonAttributes(verbs.delete)"
                @click="deleteFile(file, index)"
              )
    tfoot(
      v-if="multiple || isUploadActive || !hasFiles"
    )
      tr
        td(:colspan="4")
          .dito-upload-footer
            progress.dito-progress(
              v-if="isUploadActive"
              :value="uploadProgress"
              max="100"
            )
            .dito-buttons.dito-buttons--round
              button.dito-button(
                v-if="isUploadActive"
                type="button"
                @click.prevent="upload.active = false"
              ) Cancel
              button.dito-button.dito-button--upload(
                v-if="multiple || !hasFiles"
                :title="uploadTitle"
                @click="onClickUpload"
              )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DitoContext from '../DitoContext.js'
import SortableMixin from '../mixins/SortableMixin.js'
import parseFileSize from 'filesize-parser'
import { getSchemaAccessor } from '../utils/accessor.js'
import { formatFileSize } from '../utils/units.js'
import { appendDataPath } from '../utils/data.js'
import { isArray, asArray } from '@ditojs/utils'
import VueUpload from 'vue-upload-component'

// @vue/component
export default DitoTypeComponent.register('upload', {
  mixins: [SortableMixin],
  components: { VueUpload },

  data() {
    return {
      uploads: []
    }
  },

  computed: {
    upload() {
      return this.$refs.upload
    },

    uploadTitle() {
      return this.multiple ? 'Upload Files' : 'Upload File'
    },

    files() {
      return asFiles(this.value)
    },

    downloadUrls() {
      return this.files.map((file, index) => this.getDownloadUrl(file, index))
    },

    thumbnailUrls() {
      return this.files.map((file, index) => this.getThumbnailUrl(file, index))
    },

    multiple: getSchemaAccessor('multiple', {
      type: Boolean,
      default: false,
      // No callback as it's used in `processValue()`
      callback: false
    }),

    extensions: getSchemaAccessor('extensions', {
      type: [Array, String, RegExp]
    }),

    accept: getSchemaAccessor('accept', {
      type: Array,
      get(accept) {
        return isArray(accept) ? accept.join(',') : accept
      }
    }),

    maxSize: getSchemaAccessor('maxSize', {
      type: [String, Number],
      get(maxSize) {
        return maxSize ? parseFileSize(maxSize) : undefined
      }
    }),

    draggable: getSchemaAccessor('draggable', {
      type: Boolean,
      default: false,
      get(draggable) {
        return draggable && this.files.length > 1
      }
    }),

    deletable: getSchemaAccessor('deletable', {
      type: Boolean,
      default: false
    }),

    render: getSchemaAccessor('render', {
      type: Function,
      default: null
    }),

    thumbnails: getSchemaAccessor('thumbnails', {
      type: [Boolean, String],
      default(thumbnails) {
        return thumbnails ?? !!this.schema.thumbnailUrl
      },
      get(thumbnails) {
        return thumbnails === true ? 'medium' : thumbnails || null
      }
    }),

    hasFiles() {
      return this.files.length > 0
    },

    hasUploads() {
      return this.uploads.length > 0
    },

    isUploadReady() {
      return (
        this.hasUploads &&
        !(this.upload.active || this.upload.uploaded)
      )
    },

    isUploadActive() {
      return this.hasUploads && this.upload.active
    },

    uploadProgress() {
      return (
        this.uploads.reduce((total, file) => total + +file.progress, 0) /
        this.uploads.length
      )
    },

    uploadPath() {
      return this.getResourceUrl({
        type: 'upload',
        method: 'post',
        path: this.api.normalizePath(this.dataPath)
      })
    }
  },

  watch: {
    isUploadReady(ready) {
      if (ready) {
        // Auto-upload.
        this.$nextTick(() => {
          this.upload.active = true
        })
      }
    }
  },

  methods: {
    formatFileSize,

    getFileContext(file, index) {
      return this.multiple
        ? new DitoContext(this, {
            value: file,
            data: this.files,
            index,
            dataPath: appendDataPath(this.dataPath, index)
          })
        : this.context
    },

    renderFile(file, index) {
      return this.render(this.getFileContext(file, index))
    },

    getDownloadUrl(file, index) {
      return file.url
        ? file.url
        : !file.upload || file.upload.success
          ? this.getSchemaValue('downloadUrl', {
              type: 'String',
              default: null,
              context: this.getFileContext(file, index)
            })
          : null
    },

    getThumbnailUrl(file, index) {
      return !file.upload || file.upload.success
        ? this.getSchemaValue('thumbnailUrl', {
            type: 'String',
            default: null,
            context: this.getFileContext(file, index)
          }) || (
            file.type.startsWith('image/')
              ? file.url
              : null
          )
        : null
    },

    deleteFile(file, index) {
      const { name } = file

      if (
        file &&
        window.confirm(
          `Do you really want to ${this.verbs.remove} ${name}?`
        )
      ) {
        if (this.multiple) {
          this.value.splice(index, 1)
        } else {
          this.value = null
        }
        if (file.upload) {
          this.upload.remove(file.upload)
        }
        this.onChange()
        this.notify({
          type: 'info',
          title: 'Successfully Removed',
          text: `${name} was ${this.verbs.deleted}.`
        })
      }
    },

    getFileIndex(file) {
      return this.multiple && this.value
        ? this.value.findIndex(it => it.id === file.id)
        : -1
    },

    addFile(file) {
      if (this.multiple) {
        if (this.value) {
          this.value.push(file)
        } else {
          this.value = [file]
        }
      } else {
        this.value = file
      }
    },

    replaceFile(file, newFile) {
      if (this.multiple) {
        const index = this.getFileIndex(file)
        if (index >= 0) {
          if (newFile) {
            this.value[index] = newFile
          } else {
            this.value.splice(index, 1)
          }
        }
      } else {
        this.value = newFile
      }
    },

    removeFile(file) {
      this.replaceFile(file, null)
    },

    onInputFile(newFile, oldFile) {
      if (newFile && !oldFile) {
        const { id, name, size } = newFile
        this.addFile({ id, name, size, upload: newFile })
      }
      if (newFile && oldFile) {
        const { success, error } = newFile
        if (success) {
          this.onChange()
          const file = newFile.response[0]
          if (file) {
            file.upload = newFile
            // Replace the upload file object with the file object received
            // from the upload response.
            this.replaceFile(newFile, file)
          } else {
            this.removeFile(newFile)
          }
        } else if (error) {
          this.removeFile(newFile)
          const text = (
            {
              abort: 'Upload aborted',
              denied: 'Upload denied',
              extension: `Unsupported file-type: ${newFile.name}`,
              network: 'Network error encountered during upload',
              server: 'Server error occurred during upload',
              size: `File is too large: ${formatFileSize(newFile.size)}`,
              timeout: 'Timeout occurred during upload'
            }[error] ||
            `Unknown File Upload Error: '${error}'`
          )
          this.notify({
            type: 'error',
            error,
            title: 'File Upload Error',
            text
          })
        }
      }
    },

    onInputFilter(newFile /*, oldFile, prevent */) {
      const xhr = newFile?.xhr
      if (this.api.cors?.credentials && xhr && !xhr.withCredentials) {
        xhr.withCredentials = true
      }
    },

    async onClickDownload(file, index) {
      try {
        const response = await fetch(this.downloadUrls[index])
        const blob = await response.blob()
        this.download({
          filename: file.name,
          url: URL.createObjectURL(blob)
        })
      } catch (error) {
        console.error(error)
      }
    },

    onClickUpload(event) {
      // Delegate the click event to the hidden file input.
      this.upload.$el.querySelector('input').dispatchEvent(
        new event.constructor(event.type, event)
      )
    }
  },

  processValue({ schema, value }) {
    // Filter out all newly added files that weren't actually uploaded.
    const files = asFiles(value)
      .map(({ upload, ...file }) => (!upload || upload.success ? file : null))
      .filter(file => file)
    return schema.multiple ? files : files[0] || null
  }
})

function asFiles(value) {
  return value ? asArray(value) : []
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-upload {
  .dito-table {
    tr,
    .dito-table__buttons {
      vertical-align: middle;
    }
  }

  &__size,
  &__status {
    white-space: nowrap;
  }

  & &__input {
    // See `onClickUpload()` method for details.
    display: block;
    pointer-events: none;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;

    .dito-progress {
      flex: auto;
      margin-right: $form-spacing;
    }
  }
}
</style>
