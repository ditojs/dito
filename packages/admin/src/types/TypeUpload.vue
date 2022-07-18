<template lang="pug">
  .dito-upload
    table.dito-table.dito-table-separators.dito-table-background
      //- Styling comes from DitoTableHead
      thead.dito-table-head
        tr
          th
            span Name
          th
            span Size
          th
            span Status
          th
            span
      vue-draggable(
        tag="tbody"
        v-bind="getDragOptions(draggable)"
        :list="files"
        @start="onStartDrag"
        @end="onEndDrag"
      )
        tr(
          v-for="(file, index) in files"
          :key="file.key"
        )
          td(v-html="renderFile(file, index)")
          td {{ file.size | formatFileSize }}
          td
            template(v-if="file.upload")
              template(v-if="file.upload.error")
                | Error: {{ file.upload.error }}
              template(v-else-if="file.upload.active")
                | Uploading...
              template(v-else-if="file.upload.success")
                | Uploaded
            template(v-else)
              | Stored
          td.dito-cell-edit-buttons
            .dito-buttons.dito-buttons-round
              //- Firefox doesn't like <button> here, so use <a> instead:
              a.dito-button(
                v-if="draggable"
                v-bind="getButtonAttributes(verbs.drag)"
              )
              button.dito-button(
                v-if="deletable"
                type="button"
                @click="deleteFile(file, index)"
                v-bind="getButtonAttributes(verbs.delete)"
              )
      tfoot
        tr
          td(:colspan="4")
            .dito-upload-footer
              progress.dito-progress(
                v-if="isUploadActive"
                :value="uploadProgress"
                max="100"
              )
              .dito-buttons.dito-buttons-round
                button.dito-button(
                  v-if="isUploadActive"
                  type="button"
                  @click.prevent="upload.active = false"
                ) Cancel All
                button.dito-button(
                  v-else-if="isUploadReady"
                  type="button"
                  @click.prevent="upload.active = true"
                ) Upload All
                vue-upload.dito-button.dito-button-add-upload(
                  :input-id="dataPath"
                  :name="dataPath"
                  :disabled="disabled"
                  :post-action="uploadPath"
                  :extensions="extensions"
                  :accept="accept"
                  :multiple="multiple"
                  :size="maxSize"
                  v-model="uploads"
                  @input-filter="inputFilter"
                  @input-file="inputFile"
                  ref="upload"
                  title="Upload Files"
                )
</template>

<style lang="sass">
  .dito-upload
    .dito-table
      tr
        vertical-align: middle
    .dito-button-add-upload
      padding: 0
      > *
        position: absolute
        cursor: pointer
    .dito-upload-footer
      display: flex
      justify-content: flex-end
      align-items: center
      .dito-progress
        flex: auto
        margin-right: $form-spacing
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import DitoContext from '../DitoContext.js'
import OrderedMixin from '../mixins/OrderedMixin.js'
import VueUpload from 'vue-upload-component'
import VueDraggable from 'vuedraggable'
import parseFileSize from 'filesize-parser'
import { getSchemaAccessor } from '../utils/accessor.js'
import { formatFileSize } from '../utils/units.js'
import { appendDataPath } from '../utils/data.js'
import { isArray, asArray, escapeHtml } from '@ditojs/utils'

// @vue/component
export default TypeComponent.register('upload', {
  components: { VueUpload, VueDraggable },
  filters: { formatFileSize },
  mixins: [OrderedMixin],

  data() {
    return {
      uploads: []
    }
  },

  computed: {
    upload() {
      return this.$refs.upload
    },

    files() {
      return asFiles(this.value)
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

    isUploadReady() {
      return this.uploads.length &&
        !(this.upload.active || this.upload.uploaded)
    },

    isUploadActive() {
      return this.uploads.length && this.upload.active
    },

    uploadProgress() {
      return (
        this.uploads.reduce((total, file) => total + file.progress, 0) /
        this.uploads.length
      )
    },

    uploadPath() {
      return this.getResourceUrl({
        type: 'upload',
        path: this.api.normalizePath(this.dataPath)
      })
    }
  },

  methods: {
    renderFile(file, index) {
      const { render } = this.schema
      return render
        ? render.call(
          this,
          new DitoContext(this, {
            value: file,
            data: this.files,
            index,
            dataPath: appendDataPath(this.dataPath, index)
          })
        )
        : escapeHtml(file.name)
    },

    deleteFile(file, index) {
      const { name } = file

      if (file && window.confirm(
        `Do you really want to ${this.verbs.remove} ${name}?`)
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
            this.$set(this.value, index, newFile)
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

    inputFile(newFile, oldFile) {
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
          const text = {
            abort: 'Upload aborted',
            denied: 'Upload denied',
            extension: `Unsupported file-type: ${newFile.name}`,
            network: 'Network error encountered during upload',
            server: 'Server error occurred during upload',
            size: `File is too large: ${formatFileSize(newFile.size)}`,
            timeout: 'Timeout occurred during upload'

          }[error] || `Unknown File Upload Error: '${error}'`
          this.notify({
            type: 'error',
            title: 'File Upload Error',
            text
          })
          this.removeFile(newFile)
        }
      }
    },

    inputFilter(newFile/*, oldFile, prevent */) {
      const xhr = newFile?.xhr
      if (this.api.cors?.credentials && xhr && !xhr.withCredentials) {
        xhr.withCredentials = true
      }
    }
  },

  processValue(schema, value) {
    // Filter out all newly added files that weren't actually uploaded.
    const files = asFiles(value)
      .map(
        ({ upload, ...file }) => !upload || upload.success ? file : null
      )
      .filter(file => file)
    return schema.multiple ? files : files[0] || null
  }
})

function asFiles(value) {
  return value ? asArray(value) : []
}

</script>
