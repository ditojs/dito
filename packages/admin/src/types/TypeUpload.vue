<template lang="pug">
  .dito-upload
    table.dito-table.dito-table-separators.dito-table-background
      // Styling comes from DitoTableHead
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
          :key=" file.id || file.name"
        )
          td {{ file.originalName }}
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
          td.dito-buttons.dito-buttons-round
            button.dito-button(
              v-if="draggable"
              type="button"
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
          td.dito-buttons.dito-buttons-round(:colspan="4")
            button.dito-button(
              v-if="uploadable"
              type="button"
              @click.prevent="upload.active = true"
            ) Upload All
            button.dito-button(
              v-else-if="cancelable"
              type="button"
              @click.prevent="upload.active = false"
            ) Cancel All
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
.dito
  .dito-upload
    .dito-table
      tr
        vertical-align: middle
    .dito-button-add-upload
      box-sizing: border-box
      padding: 0
      > *
        position: absolute
        cursor: pointer
</style>

<script>
import TypeComponent from '@/TypeComponent'
import VueUpload from 'vue-upload-component'
import VueDraggable from 'vuedraggable'
import parseFileSize from 'filesize-parser'
import OrderedMixin from '@/mixins/OrderedMixin'
import { getSchemaAccessor } from '@/utils/accessor'
import { formatFileSize } from '@/utils/units'
import { isArray, asArray } from '@ditojs/utils'

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
      default: false
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

    uploadable() {
      return this.uploads.length &&
        !(this.upload.active || this.upload.uploaded)
    },

    cancelable() {
      return this.uploads.length && this.upload.active
    },

    uploadPath() {
      return this.getResourceUrl({
        type: 'upload',
        path: this.api.normalizePath(this.dataPath),
        parent: this.dataComponent.resource
      })
    }
  },

  methods: {
    getDataProcessor() {
      // Since the returned dataProcess may be used after the life-time of this
      // component, we shouldn't access `this` form inside the returned closure:
      const { multiple } = this
      return value => {
        // Filter out all newly added files that weren't actually uploaded.
        const files = asFiles(value)
          .map(
            ({ upload, ...file }) => !upload || upload.success ? file : null
          )
          .filter(file => file)
        return multiple ? files : files[0] || null
      }
    },

    deleteFile(file, index) {
      const name = file.originalName

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
        this.notify('info',
          'Successfully Removed', `${name} was ${this.verbs.removed}.`)
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
        this.addFile({
          id: newFile.id,
          originalName: newFile.name,
          size: newFile.size,
          upload: newFile
        })
      }
      if (newFile && oldFile) {
        const { success, error } = newFile
        if (success) {
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
          const message = {
            abort: `Upload aborted`,
            denied: `Upload denied`,
            extension: `Unsupported file-type: ${newFile.name}`,
            network: `Network error encountered during upload`,
            server: `Server error occurred during upload`,
            size: `File is too large: ${formatFileSize(newFile.size)}`,
            timeout: `Timeout occurred during upload`

          }[error] || `Unknown File Upload Error: '${error}'`
          this.notify('error', 'File Upload Error', message)
          this.removeFile(newFile)
        } else {
          // TODO: Implement progress bar for uploads
          console.log('update', newFile)
        }
      }
    },

    inputFilter(newFile/*, oldFile, prevent */) {
      const xhr = newFile?.xhr
      if (this.api.cors?.credentials && xhr && !xhr.withCredentials) {
        xhr.withCredentials = true
      }
    }
  }
})

function asFiles(value) {
  return value ? asArray(value) : []
}

</script>
